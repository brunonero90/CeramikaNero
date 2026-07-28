-- Ceramika Nero — unified order Stripe payments + expanded order email types.
-- Additive. Does not rewrite migrations 11–14.
-- Apply AFTER migration 14 (tracking_reference).
-- Rollback notes: drop confirm_order_from_payment; restore prior checks/columns.

-- ---------------------------------------------------------------------------
-- Orders: explicit customer-selected payment method
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists selected_payment_method text;

alter table public.orders
  drop constraint if exists orders_selected_payment_method_check;

alter table public.orders
  add constraint orders_selected_payment_method_check
  check (
    selected_payment_method is null
    or selected_payment_method in ('stripe', 'bank_transfer')
  );

comment on column public.orders.selected_payment_method is
  'Customer-chosen payment method at checkout. Never inferred from Stripe config failures.';

-- ---------------------------------------------------------------------------
-- Expand order_emails.email_type for Stripe + refund lifecycle
-- ---------------------------------------------------------------------------

alter table public.order_emails
  drop constraint if exists order_emails_email_type_check;

alter table public.order_emails
  add constraint order_emails_email_type_check
  check (email_type in (
    'customer_confirmation',
    'admin_notification',
    'shipping_quote_confirmed',
    'payment_received',
    'ready_for_pickup',
    'order_shipped',
    'cancellation',
    'awaiting_stripe_payment',
    'stripe_payment_processing',
    'payment_failed',
    'checkout_expired',
    'refund_initiated',
    'refund_completed',
    'refund_failed',
    'admin_payment_problem',
    'manual_transfer_requested'
  ));

-- ---------------------------------------------------------------------------
-- Confirm order payment from verified Stripe webhook (no capacity mutation)
-- Capacity / inventory already reserved by submit_cart_order.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_order_from_payment(
  p_order_id uuid,
  p_payment_id uuid,
  p_stripe_event_id text,
  p_provider_payment_id text,
  p_amount_gross_grosz int
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_now timestamptz;
  v_booking record;
begin
  v_now := timezone('utc'::text, now());

  if exists (select 1 from public.stripe_events where event_id = p_stripe_event_id) then
    return jsonb_build_object('already_processed', true);
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.order_id is distinct from p_order_id then
    raise exception 'Payment does not belong to order';
  end if;

  if p_amount_gross_grosz != v_payment.amount_gross_grosz then
    raise exception 'Payment amount mismatch: expected %, got %',
      v_payment.amount_gross_grosz, p_amount_gross_grosz;
  end if;

  -- Already paid/confirmed: record event and return.
  if v_order.payment_status = 'paid' then
    if v_payment.status != 'paid' then
      update public.payments
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), provider_payment_id),
          updated_at = v_now
      where id = p_payment_id;
    end if;
    insert into public.stripe_events (event_id, event_type)
    values (p_stripe_event_id, 'checkout.session.completed');
    return jsonb_build_object('status', 'confirmed', 'recovered', false);
  end if;

  -- Late payment against terminal order → manual resolution (do not resurrect).
  if v_order.status in ('cancelled', 'expired', 'refunded', 'partially_refunded') then
    update public.payments
    set status = 'paid',
        paid_at = v_now,
        provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), provider_payment_id),
        failure_message = 'Order is in a terminal state. Requires manual resolution.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.order_events (order_id, event_type, actor_type, metadata)
    values (
      p_order_id,
      'payment_manual_resolution',
      'system',
      jsonb_build_object(
        'reason', 'Order is in a terminal state',
        'stripe_event_id', p_stripe_event_id
      )
    );

    insert into public.stripe_events (event_id, event_type)
    values (p_stripe_event_id, 'checkout.session.completed');

    return jsonb_build_object('status', 'requires_manual_resolution', 'recovered', false);
  end if;

  if v_order.status not in ('awaiting_payment', 'confirmed') then
    raise exception 'Order cannot be confirmed from status %', v_order.status;
  end if;

  update public.payments
  set status = 'paid',
      paid_at = v_now,
      provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), provider_payment_id),
      failure_code = null,
      failure_message = null,
      updated_at = v_now
  where id = p_payment_id;

  update public.orders
  set payment_status = 'paid',
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, v_now),
      expires_at = null,
      updated_at = v_now
  where id = p_order_id;

  -- Confirm linked workshop bookings without touching reserved_count.
  for v_booking in
    select id, status from public.bookings where order_id = p_order_id for update
  loop
    if v_booking.status in ('pending', 'awaiting_payment') then
      update public.bookings
      set status = 'confirmed',
          expires_at = null,
          confirmed_at = coalesce(confirmed_at, v_now),
          updated_at = v_now
      where id = v_booking.id;

      insert into public.booking_events (booking_id, event_type, actor_type, metadata)
      values (
        v_booking.id,
        'confirmed',
        'system',
        jsonb_build_object('via', 'confirm_order_from_payment', 'order_id', p_order_id)
      );
    elsif v_booking.status in ('cancelled', 'expired', 'refunded', 'partially_refunded') then
      insert into public.order_events (order_id, event_type, actor_type, metadata)
      values (
        p_order_id,
        'payment_manual_resolution',
        'system',
        jsonb_build_object(
          'reason', 'Linked booking is terminal',
          'booking_id', v_booking.id,
          'booking_status', v_booking.status,
          'stripe_event_id', p_stripe_event_id
        )
      );
      insert into public.stripe_events (event_id, event_type)
      values (p_stripe_event_id, 'checkout.session.completed');
      return jsonb_build_object('status', 'requires_manual_resolution', 'recovered', false);
    end if;
  end loop;

  insert into public.order_events (order_id, event_type, actor_type, metadata)
  values (
    p_order_id,
    'payment_received',
    'system',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'stripe_event_id', p_stripe_event_id,
      'provider_payment_id', p_provider_payment_id
    )
  );

  insert into public.stripe_events (event_id, event_type)
  values (p_stripe_event_id, 'checkout.session.completed');

  return jsonb_build_object('status', 'confirmed', 'recovered', false);
end;
$$;

comment on function public.confirm_order_from_payment is
  'Marks an order paid from a verified Stripe event. Does not mutate capacity or inventory.';

revoke all on function public.confirm_order_from_payment(uuid, uuid, text, text, int)
  from public, anon, authenticated;
grant execute on function public.confirm_order_from_payment(uuid, uuid, text, text, int)
  to service_role;
