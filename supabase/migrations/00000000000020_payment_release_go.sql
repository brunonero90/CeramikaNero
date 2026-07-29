-- Ceramika Nero — final payment release rules.
-- Apply AFTER migration 19. Migrations 00–19 remain immutable.
--
-- Business rules closed by this migration:
--   * Stripe orders: 15-minute pre-Checkout hold, then the authoritative
--     Checkout Session deadline (Stripe minimum: 30 minutes).
--   * Bank-transfer and shipping-quote orders: 24-hour payment/quote window.
--   * Unified orders support full refunds only in the application.
--   * Full, unfulfilled order refunds release all linked resources once.
--   * Partial refunds made directly in Stripe are recorded and flagged, but
--     never guess which item or participant should be released.
--   * Disputes remain distinct from refunds and reduce net collected revenue
--     until won.

-- ---------------------------------------------------------------------------
-- Payment deadlines
-- ---------------------------------------------------------------------------

create or replace function public.set_order_payment_deadline()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := pg_catalog.timezone('utc'::text, pg_catalog.now());
begin
  if old.selected_payment_method is null
     and new.selected_payment_method is not null
  then
    new.expires_at := case
      when new.shipping_quote_required then v_now + interval '24 hours'
      when new.selected_payment_method = 'bank_transfer'
        then v_now + interval '24 hours'
      else v_now + interval '15 minutes'
    end;
  elsif old.shipping_quote_required
        and not new.shipping_quote_required
  then
    new.expires_at := case
      when new.selected_payment_method = 'bank_transfer'
        then v_now + interval '24 hours'
      else v_now + interval '15 minutes'
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists set_order_payment_deadline_trigger on public.orders;
create trigger set_order_payment_deadline_trigger
before update of selected_payment_method, shipping_quote_required
on public.orders
for each row
execute function public.set_order_payment_deadline();

revoke all on function public.set_order_payment_deadline()
  from public, anon, authenticated;

create or replace function public.bind_order_checkout_session(
  p_order_id uuid,
  p_payment_id uuid,
  p_provider_checkout_id text,
  p_expires_at timestamptz,
  p_amount_gross_grosz integer,
  p_currency text,
  p_livemode boolean
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
  if nullif(trim(p_provider_checkout_id), '') is null then
    raise exception 'Checkout Session id is required';
  end if;
  if p_expires_at <= v_now then
    raise exception 'Checkout Session deadline must be in the future';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found or v_payment.order_id is distinct from p_order_id then
    raise exception 'Payment does not belong to order';
  end if;
  if v_order.status <> 'awaiting_payment'
     or v_order.payment_status <> 'pending'
     or v_order.selected_payment_method <> 'stripe'
     or v_order.shipping_quote_required
  then
    raise exception 'Order is not eligible for Checkout';
  end if;
  if v_payment.provider <> 'stripe'
     or v_payment.status not in ('created', 'pending', 'failed')
  then
    raise exception 'Payment is not eligible for Checkout';
  end if;
  if v_order.total_gross_grosz <> p_amount_gross_grosz
     or v_payment.amount_gross_grosz <> p_amount_gross_grosz
     or upper(v_order.currency) <> upper(p_currency)
     or upper(v_payment.currency) <> upper(p_currency)
  then
    raise exception 'Checkout amount or currency mismatch';
  end if;
  if v_payment.provider_checkout_id is not null
     and v_payment.provider_checkout_id <> p_provider_checkout_id
     and v_payment.status = 'pending'
  then
    raise exception 'A different Checkout Session is already bound';
  end if;

  update public.payments
  set provider_checkout_id = p_provider_checkout_id,
      status = 'pending',
      livemode = p_livemode,
      failure_code = null,
      failure_message = null,
      updated_at = v_now
  where id = p_payment_id;

  update public.orders
  set expires_at = p_expires_at,
      updated_at = v_now
  where id = p_order_id;

  update public.bookings
  set expires_at = p_expires_at,
      updated_at = v_now
  where order_id = p_order_id
    and status in ('pending', 'awaiting_payment');

  return jsonb_build_object(
    'status', 'bound',
    'order_id', p_order_id,
    'payment_id', p_payment_id,
    'provider_checkout_id', p_provider_checkout_id,
    'expires_at', p_expires_at
  );
end;
$$;

revoke all on function public.bind_order_checkout_session(
  uuid, uuid, text, timestamptz, integer, text, boolean
) from public, anon, authenticated;
grant execute on function public.bind_order_checkout_session(
  uuid, uuid, text, timestamptz, integer, text, boolean
) to service_role;

create or replace function public.list_expired_unpaid_orders(
  p_limit integer default 50
)
returns table(
  order_id uuid,
  order_reference text,
  payment_id uuid,
  provider text,
  provider_checkout_id text,
  expires_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    o.id,
    o.order_reference,
    p.id,
    p.provider,
    p.provider_checkout_id,
    o.expires_at
  from public.orders o
  join lateral (
    select pp.*
    from public.payments pp
    where pp.order_id = o.id
    order by pp.created_at desc
    limit 1
  ) p on true
  where o.status = 'awaiting_payment'
    and o.payment_status in ('pending', 'failed')
    and o.fulfillment_status = 'unfulfilled'
    and o.expires_at is not null
    and o.expires_at <= timezone('utc'::text, now())
    and p.status not in ('paid', 'partially_refunded', 'refunded')
  order by o.expires_at
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke all on function public.list_expired_unpaid_orders(integer)
  from public, anon, authenticated;
grant execute on function public.list_expired_unpaid_orders(integer)
  to service_role;

create or replace function public.expire_unpaid_order(
  p_order_id uuid,
  p_expected_payment_id uuid,
  p_expected_checkout_id text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_booking record;
  v_product record;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('expired', 'cancelled') then
    return jsonb_build_object(
      'status', v_order.status,
      'already_terminal', true
    );
  end if;
  if v_order.status <> 'awaiting_payment'
     or v_order.payment_status not in ('pending', 'failed')
     or v_order.fulfillment_status <> 'unfulfilled'
  then
    return jsonb_build_object('status', 'not_eligible');
  end if;
  -- A verified checkout.session.expired webhook is authoritative even if the
  -- local clock differs by a few seconds. Cron/bank-transfer callers pass no
  -- Checkout id and must wait for the stored deadline.
  if v_order.expires_at is null
     or (
       p_expected_checkout_id is null
       and v_order.expires_at > v_now
     )
  then
    return jsonb_build_object('status', 'not_due');
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_expected_payment_id
    and order_id = p_order_id
  for update;
  if not found then
    return jsonb_build_object('status', 'stale_attempt');
  end if;
  if v_payment.status in ('paid', 'partially_refunded', 'refunded') then
    return jsonb_build_object('status', 'already_paid');
  end if;
  if v_payment.provider_checkout_id is distinct from p_expected_checkout_id then
    return jsonb_build_object('status', 'stale_attempt');
  end if;
  if exists (
    select 1
    from public.payments p
    where p.order_id = p_order_id
      and p.id <> v_payment.id
      and p.status in ('paid', 'partially_refunded', 'refunded')
  ) then
    return jsonb_build_object('status', 'already_paid');
  end if;

  for v_booking in
    select id, workshop_session_id, quantity, status
    from public.bookings
    where order_id = p_order_id
    for update
  loop
    if v_booking.status in ('pending', 'awaiting_payment') then
      update public.workshop_sessions
      set reserved_count = greatest(0, reserved_count - v_booking.quantity),
          updated_at = v_now
      where id = v_booking.workshop_session_id;

      update public.bookings
      set status = 'expired',
          cancelled_at = v_now,
          cancelled_by = 'expiry',
          cancellation_reason = left(
            coalesce(p_reason, 'Payment deadline expired'),
            500
          ),
          expires_at = null,
          updated_at = v_now
      where id = v_booking.id;

      insert into public.booking_events (
        booking_id,
        event_type,
        actor_type,
        metadata
      )
      values (
        v_booking.id,
        'expired',
        'system',
        jsonb_build_object(
          'via', 'expire_unpaid_order',
          'order_id', p_order_id
        )
      );
    end if;
  end loop;

  for v_product in
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and oi.product_id is not null
      and p.track_inventory
    group by oi.product_id
  loop
    update public.products
    set inventory_quantity = inventory_quantity + v_product.quantity,
        updated_at = v_now
    where id = v_product.product_id;
  end loop;

  update public.payments
  set status = 'cancelled',
      failure_code = coalesce(failure_code, 'payment_deadline_expired'),
      failure_message = 'Payment deadline expired',
      updated_at = v_now
  where order_id = p_order_id
    and status not in ('paid', 'partially_refunded', 'refunded');

  update public.orders
  set status = 'expired',
      payment_status = 'cancelled',
      fulfillment_status = 'cancelled',
      cancelled_at = v_now,
      expires_at = null,
      updated_at = v_now
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    p_order_id,
    'expired',
    'system',
    jsonb_build_object(
      'via', 'expire_unpaid_order',
      'payment_id', p_expected_payment_id,
      'provider', v_payment.provider,
      'had_checkout', p_expected_checkout_id is not null
    )
  );

  return jsonb_build_object(
    'status', 'expired',
    'already_terminal', false
  );
end;
$$;

revoke all on function public.expire_unpaid_order(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.expire_unpaid_order(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Full unified-order refunds
-- ---------------------------------------------------------------------------

create table if not exists public.order_resource_releases (
  order_id uuid not null references public.orders(id) on delete cascade,
  release_type text not null check (
    release_type in ('full_refund')
  ),
  operation_key text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (order_id, release_type),
  unique (operation_key)
);

alter table public.order_resource_releases enable row level security;
revoke all on table public.order_resource_releases
  from public, anon, authenticated;
grant select, insert on table public.order_resource_releases to service_role;

create or replace function public.release_refunded_order_resources(
  p_order_id uuid,
  p_operation_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_booking record;
  v_product record;
  v_inserted integer := 0;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.fulfillment_status <> 'unfulfilled' then
    return jsonb_build_object(
      'released', false,
      'requires_manual_resolution', true,
      'reason', 'order_fulfillment_started'
    );
  end if;

  insert into public.order_resource_releases (
    order_id,
    release_type,
    operation_key
  )
  values (
    p_order_id,
    'full_refund',
    p_operation_key
  )
  on conflict (order_id, release_type) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object(
      'released', false,
      'already_released', true,
      'requires_manual_resolution', false
    );
  end if;

  for v_booking in
    select id, workshop_session_id, quantity, status
    from public.bookings
    where order_id = p_order_id
    for update
  loop
    if v_booking.status in ('pending', 'awaiting_payment', 'confirmed') then
      update public.workshop_sessions
      set reserved_count = greatest(0, reserved_count - v_booking.quantity),
          updated_at = v_now
      where id = v_booking.workshop_session_id;

      update public.bookings
      set status = 'refunded',
          expires_at = null,
          updated_at = v_now
      where id = v_booking.id;

      insert into public.booking_events (
        booking_id,
        event_type,
        actor_type,
        metadata
      )
      values (
        v_booking.id,
        'refunded',
        'system',
        jsonb_build_object(
          'via', 'full_order_refund',
          'order_id', p_order_id
        )
      );
    end if;
  end loop;

  for v_product in
    select oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and oi.product_id is not null
      and p.track_inventory
    group by oi.product_id
  loop
    update public.products
    set inventory_quantity = inventory_quantity + v_product.quantity,
        updated_at = v_now
    where id = v_product.product_id;
  end loop;

  update public.orders
  set status = 'refunded',
      payment_status = 'refunded',
      fulfillment_status = 'cancelled',
      expires_at = null,
      updated_at = v_now
  where id = p_order_id;

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    p_order_id,
    'refund_resources_released',
    'system',
    jsonb_build_object('operation_key', p_operation_key)
  );

  return jsonb_build_object(
    'released', true,
    'already_released', false,
    'requires_manual_resolution', false
  );
end;
$$;

revoke all on function public.release_refunded_order_resources(uuid, text)
  from public, anon, authenticated;
grant execute on function public.release_refunded_order_resources(uuid, text)
  to service_role;

create or replace function public.record_order_refund_safe(
  p_order_id uuid,
  p_payment_id uuid,
  p_refund_amount_grosz integer,
  p_expected_refunded_total_grosz integer,
  p_reason text,
  p_operation_key text,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_release jsonb;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Refund operation key is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.fulfillment_status <> 'unfulfilled' then
    raise exception 'Fulfilled orders require a manual return decision';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
    and order_id = p_order_id
  for update;
  if not found then
    raise exception 'Payment does not belong to order';
  end if;

  if exists (
    select 1
    from public.order_events e
    where e.order_id = p_order_id
      and e.event_type = 'refund_completed'
      and e.metadata ->> 'operation_key' = p_operation_key
  ) then
    return jsonb_build_object(
      'status', v_payment.status,
      'already_recorded', true,
      'refunded_amount_grosz', v_payment.refunded_amount_grosz
    );
  end if;

  if p_refund_amount_grosz <= 0
     or p_refund_amount_grosz
       <> v_payment.amount_gross_grosz - v_payment.refunded_amount_grosz
     or p_expected_refunded_total_grosz <> v_payment.amount_gross_grosz
  then
    raise exception 'Unified orders support a full remaining refund only';
  end if;

  if v_payment.refunded_amount_grosz >= v_payment.amount_gross_grosz then
    v_release := public.release_refunded_order_resources(
      p_order_id,
      p_operation_key
    );
    return jsonb_build_object(
      'status', 'refunded',
      'already_synchronized', true,
      'refunded_amount_grosz', v_payment.refunded_amount_grosz,
      'resources', v_release
    );
  end if;
  if v_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'Payment cannot be refunded from status %', v_payment.status;
  end if;

  update public.payments
  set refunded_amount_grosz = v_payment.amount_gross_grosz,
      status = 'refunded',
      refund_reason = left(p_reason, 1000),
      updated_at = v_now
  where id = p_payment_id;

  update public.orders
  set status = 'refunded',
      payment_status = 'refunded',
      updated_at = v_now
  where id = p_order_id;

  v_release := public.release_refunded_order_resources(
    p_order_id,
    p_operation_key
  );

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  )
  values (
    p_order_id,
    'refund_completed',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'actor_role', p_actor_role,
      'operation_key', p_operation_key,
      'refund_amount_grosz', p_refund_amount_grosz,
      'has_reason', nullif(trim(p_reason), '') is not null,
      'resources_released', coalesce(
        (v_release ->> 'released')::boolean,
        false
      )
    )
  );

  return jsonb_build_object(
    'status', 'refunded',
    'refunded_amount_grosz', v_payment.amount_gross_grosz,
    'resources', v_release
  );
end;
$$;

revoke all on function public.record_order_refund_safe(
  uuid, uuid, integer, integer, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_order_refund_safe(
  uuid, uuid, integer, integer, text, text, uuid, text
) to service_role;

-- Replace migration 19's ledger synchronizer: full unfulfilled order refunds
-- are deterministic; partial/direct or fulfilled-order refunds remain flagged.
create or replace function public.sync_stripe_refund(
  p_provider_payment_id text,
  p_refunded_amount_grosz integer,
  p_currency text,
  p_livemode boolean,
  p_stripe_event_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_booking public.bookings;
  v_status text;
  v_release jsonb := '{}'::jsonb;
  v_requires_manual boolean := false;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_payment
  from public.payments
  where provider = 'stripe'
    and provider_payment_id = p_provider_payment_id
  for update;

  if not found then
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  if upper(coalesce(p_currency, '')) <> upper(v_payment.currency) then
    raise exception 'Refund currency mismatch';
  end if;
  if v_payment.livemode is not null
     and v_payment.livemode is distinct from p_livemode
  then
    raise exception 'Refund livemode mismatch';
  end if;
  if p_refunded_amount_grosz < 0
     or p_refunded_amount_grosz > v_payment.amount_gross_grosz
  then
    raise exception 'Refund amount is outside payment bounds';
  end if;
  if p_refunded_amount_grosz < v_payment.refunded_amount_grosz then
    return jsonb_build_object(
      'status', 'stale_event',
      'refunded_amount_grosz', v_payment.refunded_amount_grosz
    );
  end if;

  v_status := case
    when p_refunded_amount_grosz = v_payment.amount_gross_grosz
      then 'refunded'
    when p_refunded_amount_grosz > 0
      then 'partially_refunded'
    else v_payment.status
  end;

  update public.payments
  set refunded_amount_grosz = p_refunded_amount_grosz,
      status = v_status,
      refund_reason = 'Synchronized from verified Stripe refund event',
      livemode = p_livemode,
      updated_at = v_now
  where id = v_payment.id;

  if v_payment.order_id is not null then
    update public.orders
    set payment_status = v_status,
        status = case
          when v_status in ('partially_refunded', 'refunded') then v_status
          else status
        end,
        updated_at = v_now
    where id = v_payment.order_id;

    if v_status = 'refunded' then
      v_release := public.release_refunded_order_resources(
        v_payment.order_id,
        'stripe-event-' || p_stripe_event_id
      );
      v_requires_manual := coalesce(
        (v_release ->> 'requires_manual_resolution')::boolean,
        false
      );
    elsif v_status = 'partially_refunded' then
      v_requires_manual := true;
    end if;

    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      v_payment.order_id,
      'refund_detected',
      'system',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'refund_status', v_status,
        'refunded_amount_grosz', p_refunded_amount_grosz,
        'stripe_event_id', p_stripe_event_id,
        'resources_released', coalesce(
          (v_release ->> 'released')::boolean,
          false
        ),
        'requires_item_allocation_review', v_requires_manual
      )
    );
  elsif v_payment.booking_id is not null then
    select *
    into v_booking
    from public.bookings
    where id = v_payment.booking_id
    for update;

    if v_status = 'refunded' then
      if v_booking.status in ('pending', 'awaiting_payment', 'confirmed') then
        update public.workshop_sessions
        set reserved_count = greatest(0, reserved_count - v_booking.quantity),
            updated_at = v_now
        where id = v_booking.workshop_session_id;
      end if;
      update public.bookings
      set status = 'refunded',
          expires_at = null,
          updated_at = v_now
      where id = v_booking.id;
    end if;

    insert into public.booking_events (
      booking_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      v_payment.booking_id,
      'refunded',
      'system',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'refund_status', v_status,
        'refunded_amount_grosz', p_refunded_amount_grosz,
        'stripe_event_id', p_stripe_event_id,
        'requires_booking_state_review', v_status <> 'refunded'
      )
    );
    v_requires_manual := v_status <> 'refunded';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'payment_id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'order_id', v_payment.order_id,
    'refunded_amount_grosz', p_refunded_amount_grosz,
    'requires_manual_resolution', v_requires_manual
  );
end;
$$;

revoke all on function public.sync_stripe_refund(
  text, integer, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.sync_stripe_refund(
  text, integer, text, boolean, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Disputes / chargebacks (financially distinct from refunds)
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists disputed_amount_grosz integer not null default 0
    check (disputed_amount_grosz >= 0),
  add column if not exists latest_dispute_status text,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_resolved_at timestamptz;

create table if not exists public.payment_disputes (
  dispute_id text primary key,
  payment_id uuid not null references public.payments(id) on delete cascade,
  provider_payment_id text not null,
  amount_gross_grosz integer not null check (amount_gross_grosz > 0),
  currency text not null,
  status text not null,
  livemode boolean not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_payment_disputes_payment
  on public.payment_disputes (payment_id, updated_at desc);

alter table public.payment_disputes enable row level security;
revoke all on table public.payment_disputes
  from public, anon, authenticated;
grant select, insert, update on table public.payment_disputes to service_role;

create or replace function public.sync_stripe_dispute(
  p_provider_payment_id text,
  p_dispute_id text,
  p_amount_gross_grosz integer,
  p_currency text,
  p_status text,
  p_livemode boolean,
  p_stripe_event_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_disputed integer;
  v_now timestamptz := timezone('utc'::text, now());
  v_resolved boolean;
  v_requires_admin_action boolean;
  v_event_type text;
begin
  if nullif(trim(p_dispute_id), '') is null
     or nullif(trim(p_status), '') is null
  then
    raise exception 'Dispute id and status are required';
  end if;

  select *
  into v_payment
  from public.payments
  where provider = 'stripe'
    and provider_payment_id = p_provider_payment_id
  for update;
  if not found then
    return jsonb_build_object('status', 'unknown_payment');
  end if;
  if upper(coalesce(p_currency, '')) <> upper(v_payment.currency) then
    raise exception 'Dispute currency mismatch';
  end if;
  if v_payment.livemode is not null
     and v_payment.livemode is distinct from p_livemode
  then
    raise exception 'Dispute livemode mismatch';
  end if;
  if p_amount_gross_grosz <= 0
     or p_amount_gross_grosz > v_payment.amount_gross_grosz
  then
    raise exception 'Dispute amount is outside payment bounds';
  end if;
  if exists (
    select 1
    from public.payment_disputes d
    where d.dispute_id = p_dispute_id
      and d.payment_id <> v_payment.id
  ) then
    raise exception 'Dispute belongs to a different payment';
  end if;

  insert into public.payment_disputes (
    dispute_id,
    payment_id,
    provider_payment_id,
    amount_gross_grosz,
    currency,
    status,
    livemode,
    updated_at
  )
  values (
    p_dispute_id,
    v_payment.id,
    p_provider_payment_id,
    p_amount_gross_grosz,
    upper(p_currency),
    p_status,
    p_livemode,
    v_now
  )
  on conflict (dispute_id) do update
  set status = excluded.status,
      amount_gross_grosz = excluded.amount_gross_grosz,
      currency = excluded.currency,
      livemode = excluded.livemode,
      updated_at = excluded.updated_at
  where public.payment_disputes.payment_id = excluded.payment_id;

  select coalesce(sum(d.amount_gross_grosz), 0)::integer
  into v_disputed
  from public.payment_disputes d
  where d.payment_id = v_payment.id
    and d.status in ('needs_response', 'under_review', 'lost');

  v_resolved := p_status in ('won', 'lost', 'warning_closed', 'prevented');
  v_requires_admin_action := p_status in (
    'needs_response',
    'under_review',
    'warning_needs_response',
    'warning_under_review'
  );
  update public.payments
  set disputed_amount_grosz = v_disputed,
      latest_dispute_status = p_status,
      disputed_at = coalesce(disputed_at, v_now),
      dispute_resolved_at = case
        when v_resolved then v_now
        else null
      end,
      updated_at = v_now
  where id = v_payment.id;

  v_event_type := case
    when v_resolved then 'dispute_resolved'
    else 'payment_disputed'
  end;

  if v_payment.order_id is not null then
    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      v_payment.order_id,
      v_event_type,
      'system',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'dispute_id', p_dispute_id,
        'status', p_status,
        'amount_gross_grosz', p_amount_gross_grosz,
        'stripe_event_id', p_stripe_event_id,
        'requires_admin_action', v_requires_admin_action
      )
    );
  elsif v_payment.booking_id is not null then
    insert into public.booking_events (
      booking_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      v_payment.booking_id,
      'payment_failed',
      'system',
      jsonb_build_object(
        'reason', v_event_type,
        'payment_id', v_payment.id,
        'dispute_id', p_dispute_id,
        'status', p_status,
        'amount_gross_grosz', p_amount_gross_grosz,
        'stripe_event_id', p_stripe_event_id,
        'requires_admin_action', v_requires_admin_action
      )
    );
  end if;

  return jsonb_build_object(
    'status', p_status,
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'booking_id', v_payment.booking_id,
    'disputed_amount_grosz', v_disputed,
    'requires_admin_action', v_requires_admin_action
  );
end;
$$;

revoke all on function public.sync_stripe_dispute(
  text, text, integer, text, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.sync_stripe_dispute(
  text, text, integer, text, text, boolean, text
) to service_role;

-- Migration 18 view, extended with dispute facts and still free of PII.
drop view if exists public.analytics_payment_facts;
create view public.analytics_payment_facts
with (security_invoker = true)
as
select
  p.id as payment_id,
  p.order_id,
  p.booking_id,
  p.provider,
  p.status,
  p.amount_gross_grosz,
  p.refunded_amount_grosz,
  p.disputed_amount_grosz,
  p.latest_dispute_status,
  p.paid_at,
  p.livemode,
  p.created_at,
  coalesce(o.analytics_excluded, b.analytics_excluded, false)
    as analytics_excluded,
  o.selected_payment_method,
  b.workshop_session_id,
  b.quantity as booking_quantity,
  b.status as booking_status,
  b.source as booking_source,
  b.created_at as booking_created_at,
  ws.starts_at as session_starts_at,
  ws.capacity as session_capacity,
  ws.workshop_id,
  ws.instructor_id,
  ws.location_name,
  ws.attendance_reviewed_at
from public.payments p
left join public.orders o on o.id = p.order_id
left join public.bookings b on b.id = coalesce(p.booking_id, (
  select bb.id
  from public.bookings bb
  where bb.order_id = p.order_id
  limit 1
))
left join public.workshop_sessions ws on ws.id = b.workshop_session_id;

comment on view public.analytics_payment_facts is
  'Non-PII payment/booking/session facts. Net collected revenue subtracts refunds and active/lost disputes.';

revoke all on public.analytics_payment_facts
  from public, anon, authenticated;
grant select on public.analytics_payment_facts to service_role;

comment on function public.expire_unpaid_order(uuid, uuid, text, text) is
  'Atomically expires one exact unpaid order attempt and releases seats/inventory once.';
comment on function public.record_order_refund_safe(
  uuid, uuid, integer, integer, text, text, uuid, text
) is
  'Records a full remaining unified-order refund only; partial allocation is deliberately unsupported.';
comment on function public.sync_stripe_dispute(
  text, text, integer, text, text, boolean, text
) is
  'Tracks Stripe disputes separately from refunds and maintains the non-PII disputed revenue amount.';
