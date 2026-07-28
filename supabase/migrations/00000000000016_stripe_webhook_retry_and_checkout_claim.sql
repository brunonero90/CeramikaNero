-- Ceramika Nero — Stripe webhook processing state + atomic order checkout claim.
-- Additive. Does not rewrite migrations 14–15.
-- Apply AFTER migration 15.
-- Rollback notes: drop claim RPCs; drop new stripe_events columns.

-- ---------------------------------------------------------------------------
-- stripe_events: distinguish received / processed / failed (retryable)
-- ---------------------------------------------------------------------------

alter table public.stripe_events
  add column if not exists processing_status text;

alter table public.stripe_events
  add column if not exists last_error text;

alter table public.stripe_events
  add column if not exists attempt_count integer not null default 1;

-- Existing rows were inserted only after success — treat as processed.
update public.stripe_events
set processing_status = 'processed'
where processing_status is null;

alter table public.stripe_events
  alter column processing_status set default 'received';

alter table public.stripe_events
  alter column processing_status set not null;

alter table public.stripe_events
  drop constraint if exists stripe_events_processing_status_check;

alter table public.stripe_events
  add constraint stripe_events_processing_status_check
  check (processing_status in ('received', 'processed', 'failed'));

comment on column public.stripe_events.processing_status is
  'received = claimed for processing; processed = success; failed = retryable.';

-- ---------------------------------------------------------------------------
-- Claim / complete / fail Stripe events (atomic, concurrent-safe)
-- ---------------------------------------------------------------------------

create or replace function public.claim_stripe_event(
  p_event_id text,
  p_event_type text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.stripe_events;
begin
  insert into public.stripe_events (event_id, event_type, processing_status, attempt_count)
  values (p_event_id, p_event_type, 'received', 1)
  on conflict (event_id) do nothing;

  select * into v_row from public.stripe_events where event_id = p_event_id for update;

  if v_row.processing_status = 'processed' then
    return jsonb_build_object('status', 'already_processed');
  end if;

  -- Reclaim failed or currently received (retry / crash recovery).
  update public.stripe_events
  set processing_status = 'received',
      attempt_count = attempt_count + case when processing_status = 'failed' then 1 else 0 end,
      last_error = null,
      processed_at = timezone('utc'::text, now())
  where event_id = p_event_id;

  return jsonb_build_object('status', 'claimed');
end;
$$;

create or replace function public.complete_stripe_event(
  p_event_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.stripe_events
  set processing_status = 'processed',
      last_error = null,
      processed_at = timezone('utc'::text, now())
  where event_id = p_event_id;
end;
$$;

create or replace function public.fail_stripe_event(
  p_event_id text,
  p_error text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.stripe_events
  set processing_status = 'failed',
      last_error = left(coalesce(p_error, 'unknown'), 500),
      processed_at = timezone('utc'::text, now())
  where event_id = p_event_id;
end;
$$;

revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text) from public, anon, authenticated;
revoke all on function public.fail_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;
grant execute on function public.complete_stripe_event(text) to service_role;
grant execute on function public.fail_stripe_event(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic checkout eligibility claim for unified orders
-- ---------------------------------------------------------------------------

create or replace function public.claim_order_checkout_attempt(
  p_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object('status', 'already_paid');
  end if;

  if v_order.status in ('cancelled', 'expired', 'refunded', 'partially_refunded') then
    return jsonb_build_object('status', 'terminal', 'order_status', v_order.status);
  end if;

  if v_order.shipping_quote_required then
    return jsonb_build_object('status', 'shipping_quote_required');
  end if;

  -- Prefer the latest stripe payment attempt for this order.
  select * into v_payment
  from public.payments
  where order_id = p_order_id
  order by created_at desc
  limit 1
  for update;

  if found then
    if v_payment.status = 'paid' then
      return jsonb_build_object(
        'status', 'already_paid',
        'payment_id', v_payment.id
      );
    end if;

    -- Mark in-flight Stripe attempt so concurrent callers see processing.
    if v_payment.provider = 'stripe'
       and v_payment.status in ('created', 'pending')
       and v_payment.provider_checkout_id is not null
       and coalesce(v_payment.failure_message, '') = 'stripe_checkout_reconciling'
    then
      return jsonb_build_object(
        'status', 'reconciling',
        'payment_id', v_payment.id,
        'provider_checkout_id', v_payment.provider_checkout_id
      );
    end if;

    return jsonb_build_object(
      'status', 'eligible',
      'payment_id', v_payment.id,
      'payment_status', v_payment.status,
      'provider', v_payment.provider,
      'provider_checkout_id', v_payment.provider_checkout_id,
      'amount_gross_grosz', v_payment.amount_gross_grosz
    );
  end if;

  return jsonb_build_object('status', 'eligible', 'payment_id', null);
end;
$$;

comment on function public.claim_order_checkout_attempt is
  'Locks the order and returns checkout eligibility. Does not create Stripe sessions.';

revoke all on function public.claim_order_checkout_attempt(uuid) from public, anon, authenticated;
grant execute on function public.claim_order_checkout_attempt(uuid) to service_role;

-- Soften confirm_order_from_payment amount check: allow matching order total
-- when payment row is still pending (avoids mismatch after quote/sync races).
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

  -- Prefer processing_status when migration 16 columns exist.
  if exists (
    select 1 from public.stripe_events
    where event_id = p_stripe_event_id
      and processing_status = 'processed'
  ) then
    return jsonb_build_object('already_processed', true);
  end if;

  -- Legacy rows without processing_status still short-circuit if present as processed default.
  if exists (
    select 1 from public.stripe_events
    where event_id = p_stripe_event_id
      and processing_status is null
  ) then
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

  -- Accept Stripe amount when it matches the payment row OR the order total.
  if p_amount_gross_grosz != v_payment.amount_gross_grosz
     and p_amount_gross_grosz != v_order.total_gross_grosz then
    raise exception 'Payment amount mismatch: expected % or %, got %',
      v_payment.amount_gross_grosz, v_order.total_gross_grosz, p_amount_gross_grosz;
  end if;

  -- Sync payment amount to the verified Stripe total.
  if v_payment.amount_gross_grosz != p_amount_gross_grosz then
    update public.payments
    set amount_gross_grosz = p_amount_gross_grosz,
        updated_at = v_now
    where id = p_payment_id;
    v_payment.amount_gross_grosz := p_amount_gross_grosz;
  end if;

  if v_order.payment_status = 'paid' then
    if v_payment.status != 'paid' then
      update public.payments
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), provider_payment_id),
          failure_code = null,
          failure_message = null,
          updated_at = v_now
      where id = p_payment_id;
    end if;
    insert into public.stripe_events (event_id, event_type, processing_status)
    values (p_stripe_event_id, 'checkout.session.completed', 'processed')
    on conflict (event_id) do update
      set processing_status = 'processed', last_error = null, processed_at = v_now;
    return jsonb_build_object('status', 'confirmed', 'recovered', false);
  end if;

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

    insert into public.stripe_events (event_id, event_type, processing_status)
    values (p_stripe_event_id, 'checkout.session.completed', 'processed')
    on conflict (event_id) do update
      set processing_status = 'processed', last_error = null, processed_at = v_now;

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
      insert into public.stripe_events (event_id, event_type, processing_status)
      values (p_stripe_event_id, 'checkout.session.completed', 'processed')
      on conflict (event_id) do update
        set processing_status = 'processed', last_error = null, processed_at = v_now;
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

  insert into public.stripe_events (event_id, event_type, processing_status)
  values (p_stripe_event_id, 'checkout.session.completed', 'processed')
  on conflict (event_id) do update
    set processing_status = 'processed', last_error = null, processed_at = v_now;

  return jsonb_build_object('status', 'confirmed', 'recovered', false);
end;
$$;
