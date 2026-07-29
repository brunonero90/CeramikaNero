-- Ceramika Nero — booking and payment release hardening.
-- Additive/replacement-only migration. Apply AFTER migration 18.
-- Migrations 00–18 remain immutable.

-- ---------------------------------------------------------------------------
-- Fixed search path for the shared SECURITY DEFINER trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.timezone('utc'::text, pg_catalog.now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exclusive, retryable Stripe event claims
-- ---------------------------------------------------------------------------

alter table public.stripe_events
  add column if not exists processing_started_at timestamptz;

update public.stripe_events
set processing_started_at = coalesce(processed_at, created_at)
where processing_status = 'received'
  and processing_started_at is null;

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
  v_now timestamptz := timezone('utc'::text, now());
  v_inserted integer := 0;
begin
  insert into public.stripe_events (
    event_id,
    event_type,
    processing_status,
    processing_started_at,
    attempt_count
  )
  values (p_event_id, p_event_type, 'received', v_now, 1)
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    return jsonb_build_object('status', 'claimed');
  end if;

  select *
  into v_row
  from public.stripe_events
  where event_id = p_event_id
  for update;

  if v_row.processing_status = 'processed' then
    return jsonb_build_object('status', 'already_processed');
  end if;

  if v_row.processing_status = 'received'
     and v_row.processing_started_at is not null
     and v_row.processing_started_at > v_now - interval '5 minutes'
  then
    return jsonb_build_object('status', 'in_progress');
  end if;

  update public.stripe_events
  set event_type = p_event_type,
      processing_status = 'received',
      processing_started_at = v_now,
      attempt_count = attempt_count + 1,
      last_error = null
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
      processing_started_at = null,
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
      processing_started_at = null,
      last_error = left(coalesce(p_error, 'unknown'), 500),
      processed_at = timezone('utc'::text, now())
  where event_id = p_event_id;
end;
$$;

revoke all on function public.claim_stripe_event(text, text)
  from public, anon, authenticated;
revoke all on function public.complete_stripe_event(text)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_event(text, text)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;
grant execute on function public.complete_stripe_event(text) to service_role;
grant execute on function public.fail_stripe_event(text, text) to service_role;

create or replace function public.claim_order_emails_for_dispatch(
  p_limit integer default 20,
  p_claim_seconds integer default 120
)
returns setof public.order_emails
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  with candidates as (
    select e.id
    from public.order_emails e
    where e.status in ('pending', 'failed')
      and e.attempt_count < 8
      and (e.next_attempt_at is null or e.next_attempt_at <= v_now)
      and (
        e.claimed_at is null
        or e.claimed_at
          < v_now - make_interval(secs => greatest(p_claim_seconds, 30))
      )
      and (
        e.error_message is null
        or e.error_message not ilike '%permanent%'
        or e.status = 'pending'
      )
    order by e.created_at asc
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update public.order_emails e
    set claimed_at = v_now,
        updated_at = v_now
    from candidates c
    where e.id = c.id
    returning e.*
  )
  select * from claimed;
end;
$$;

revoke all on function public.claim_order_emails_for_dispatch(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_order_emails_for_dispatch(integer, integer)
  to service_role;

-- A raw portal token is needed only to return the same successful result after
-- a lost HTTP response. Keep it out of owner-visible event/audit history.
create table if not exists public.order_portal_token_recovery (
  order_id uuid primary key references public.orders(id) on delete cascade,
  public_lookup_token text not null check (length(public_lookup_token) >= 32),
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.order_portal_token_recovery enable row level security;
revoke all on table public.order_portal_token_recovery
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.order_portal_token_recovery
  to service_role;

insert into public.order_portal_token_recovery (
  order_id,
  public_lookup_token
)
select
  oe.order_id,
  oe.metadata ->> 'public_lookup_token'
from public.order_events oe
where oe.event_type = 'portal_token_issued'
  and length(coalesce(oe.metadata ->> 'public_lookup_token', '')) >= 32
on conflict (order_id) do nothing;

update public.order_events
set metadata = jsonb_build_object('token_relocated', true)
where event_type = 'portal_token_issued'
  and metadata ? 'public_lookup_token';

-- ---------------------------------------------------------------------------
-- Strict Stripe confirmation. The webhook claim owns event idempotency; these
-- functions own entity/payment consistency and never consume the event early.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_booking_from_stripe(
  p_booking_id uuid,
  p_payment_id uuid,
  p_stripe_event_id text,
  p_provider_checkout_id text,
  p_provider_payment_id text,
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
  v_booking public.bookings;
  v_payment public.payments;
  v_session public.workshop_sessions;
  v_now timestamptz := timezone('utc'::text, now());
  v_available integer;
begin
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.booking_id is distinct from p_booking_id
     or v_payment.order_id is not null
  then
    raise exception 'Payment does not belong to booking';
  end if;
  if v_payment.provider <> 'stripe' then
    raise exception 'Payment provider mismatch';
  end if;
  if p_amount_gross_grosz <> v_payment.amount_gross_grosz
     or p_amount_gross_grosz <> v_booking.total_price_gross_grosz
  then
    raise exception 'Payment amount mismatch';
  end if;
  if upper(coalesce(p_currency, '')) <> upper(v_payment.currency)
     or upper(coalesce(p_currency, '')) <> upper(v_booking.currency)
  then
    raise exception 'Payment currency mismatch';
  end if;
  if v_payment.livemode is not null
     and v_payment.livemode is distinct from p_livemode
  then
    raise exception 'Payment livemode mismatch';
  end if;
  if nullif(p_provider_checkout_id, '') is not null
     and v_payment.provider_checkout_id is not null
     and v_payment.provider_checkout_id <> p_provider_checkout_id
  then
    raise exception 'Checkout session mismatch';
  end if;
  if nullif(p_provider_payment_id, '') is not null
     and v_payment.provider_payment_id is not null
     and v_payment.provider_payment_id <> p_provider_payment_id
  then
    raise exception 'PaymentIntent mismatch';
  end if;

  if v_booking.status = 'confirmed' then
    if v_payment.status = 'paid' then
      return jsonb_build_object(
        'status', 'confirmed',
        'already_confirmed', true,
        'recovered', false
      );
    end if;

    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        provider_checkout_id = coalesce(
          nullif(p_provider_checkout_id, ''),
          provider_checkout_id
        ),
        provider_payment_id = coalesce(
          nullif(p_provider_payment_id, ''),
          provider_payment_id
        ),
        livemode = p_livemode,
        failure_code = null,
        failure_message =
          'Booking was already confirmed before this Stripe payment. Requires manual duplicate-payment review.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.booking_events (
      booking_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      p_booking_id,
      'payment_failed',
      'system',
      jsonb_build_object(
        'reason', 'Duplicate successful payment requires manual review',
        'stripe_event_id', p_stripe_event_id,
        'payment_id', p_payment_id
      )
    );

    return jsonb_build_object(
      'status', 'requires_manual_resolution',
      'reason', 'duplicate_successful_payment',
      'recovered', false
    );
  end if;

  if v_booking.status in (
    'cancelled',
    'refunded',
    'partially_refunded'
  ) then
    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        provider_checkout_id = coalesce(
          nullif(p_provider_checkout_id, ''),
          provider_checkout_id
        ),
        provider_payment_id = coalesce(
          nullif(p_provider_payment_id, ''),
          provider_payment_id
        ),
        livemode = p_livemode,
        failure_message =
          'Booking is terminal. Successful Stripe payment requires manual resolution.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.booking_events (
      booking_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      p_booking_id,
      'payment_failed',
      'system',
      jsonb_build_object(
        'reason', 'Successful payment for terminal booking',
        'stripe_event_id', p_stripe_event_id,
        'payment_id', p_payment_id
      )
    );

    return jsonb_build_object(
      'status', 'requires_manual_resolution',
      'reason', 'terminal_booking',
      'recovered', false
    );
  end if;

  if v_booking.status not in ('pending', 'awaiting_payment', 'expired') then
    raise exception 'Booking cannot be confirmed from status %', v_booking.status;
  end if;

  if v_booking.status = 'expired' then
    select *
    into v_session
    from public.workshop_sessions
    where id = v_booking.workshop_session_id
    for update;

    v_available := v_session.capacity - v_session.reserved_count;
    if v_available < v_booking.quantity then
      update public.payments
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          provider_checkout_id = coalesce(
            nullif(p_provider_checkout_id, ''),
            provider_checkout_id
          ),
          provider_payment_id = coalesce(
            nullif(p_provider_payment_id, ''),
            provider_payment_id
          ),
          livemode = p_livemode,
          failure_message =
            'Booking expired and capacity is unavailable. Requires manual resolution.',
          updated_at = v_now
      where id = p_payment_id;

      insert into public.booking_events (
        booking_id,
        event_type,
        actor_type,
        metadata
      )
      values (
        p_booking_id,
        'payment_failed',
        'system',
        jsonb_build_object(
          'reason', 'Expired booking cannot reacquire capacity',
          'stripe_event_id', p_stripe_event_id,
          'payment_id', p_payment_id
        )
      );

      return jsonb_build_object(
        'status', 'requires_manual_resolution',
        'reason', 'capacity_unavailable',
        'recovered', false
      );
    end if;

    update public.workshop_sessions
    set reserved_count = reserved_count + v_booking.quantity,
        updated_at = v_now
    where id = v_booking.workshop_session_id;
  end if;

  update public.bookings
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, v_now),
      expires_at = null,
      updated_at = v_now
  where id = p_booking_id;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      provider_checkout_id = coalesce(
        nullif(p_provider_checkout_id, ''),
        provider_checkout_id
      ),
      provider_payment_id = coalesce(
        nullif(p_provider_payment_id, ''),
        provider_payment_id
      ),
      livemode = p_livemode,
      failure_code = null,
      failure_message = null,
      updated_at = v_now
  where id = p_payment_id;

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    p_booking_id,
    'confirmed',
    'system',
    jsonb_build_object(
      'via', 'confirm_booking_from_stripe',
      'stripe_event_id', p_stripe_event_id,
      'payment_id', p_payment_id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'recovered', v_booking.status = 'expired'
  );
end;
$$;

create or replace function public.confirm_order_from_stripe(
  p_order_id uuid,
  p_payment_id uuid,
  p_stripe_event_id text,
  p_provider_checkout_id text,
  p_provider_payment_id text,
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
  v_booking record;
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

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if v_payment.order_id is distinct from p_order_id
     or v_payment.booking_id is not null
  then
    raise exception 'Payment does not belong to order';
  end if;
  if v_payment.provider <> 'stripe' then
    raise exception 'Payment provider mismatch';
  end if;
  if p_amount_gross_grosz <> v_payment.amount_gross_grosz
     or p_amount_gross_grosz <> v_order.total_gross_grosz
  then
    raise exception 'Payment amount mismatch';
  end if;
  if upper(coalesce(p_currency, '')) <> upper(v_payment.currency)
     or upper(coalesce(p_currency, '')) <> upper(v_order.currency)
  then
    raise exception 'Payment currency mismatch';
  end if;
  if v_payment.livemode is not null
     and v_payment.livemode is distinct from p_livemode
  then
    raise exception 'Payment livemode mismatch';
  end if;
  if nullif(p_provider_checkout_id, '') is not null
     and v_payment.provider_checkout_id is not null
     and v_payment.provider_checkout_id <> p_provider_checkout_id
  then
    raise exception 'Checkout session mismatch';
  end if;
  if nullif(p_provider_payment_id, '') is not null
     and v_payment.provider_payment_id is not null
     and v_payment.provider_payment_id <> p_provider_payment_id
  then
    raise exception 'PaymentIntent mismatch';
  end if;

  if v_order.payment_status = 'paid' then
    if v_payment.status = 'paid' then
      return jsonb_build_object(
        'status', 'confirmed',
        'already_confirmed', true,
        'recovered', false
      );
    end if;

    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        provider_checkout_id = coalesce(
          nullif(p_provider_checkout_id, ''),
          provider_checkout_id
        ),
        provider_payment_id = coalesce(
          nullif(p_provider_payment_id, ''),
          provider_payment_id
        ),
        livemode = p_livemode,
        failure_code = null,
        failure_message =
          'Order was already paid before this Stripe payment. Requires manual duplicate-payment review.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      p_order_id,
      'payment_manual_resolution',
      'system',
      jsonb_build_object(
        'reason', 'Duplicate successful payment requires manual review',
        'stripe_event_id', p_stripe_event_id,
        'payment_id', p_payment_id
      )
    );

    return jsonb_build_object(
      'status', 'requires_manual_resolution',
      'reason', 'duplicate_successful_payment',
      'recovered', false
    );
  end if;

  if v_order.status in (
    'cancelled',
    'expired',
    'refunded',
    'partially_refunded'
  ) then
    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        provider_checkout_id = coalesce(
          nullif(p_provider_checkout_id, ''),
          provider_checkout_id
        ),
        provider_payment_id = coalesce(
          nullif(p_provider_payment_id, ''),
          provider_payment_id
        ),
        livemode = p_livemode,
        failure_message =
          'Order is terminal. Successful Stripe payment requires manual resolution.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      p_order_id,
      'payment_manual_resolution',
      'system',
      jsonb_build_object(
        'reason', 'Successful payment for terminal order',
        'stripe_event_id', p_stripe_event_id,
        'payment_id', p_payment_id
      )
    );

    return jsonb_build_object(
      'status', 'requires_manual_resolution',
      'reason', 'terminal_order',
      'recovered', false
    );
  end if;

  if v_order.status not in ('awaiting_payment', 'confirmed') then
    raise exception 'Order cannot be confirmed from status %', v_order.status;
  end if;

  for v_booking in
    select id, status
    from public.bookings
    where order_id = p_order_id
    for update
  loop
    if v_booking.status in (
      'cancelled',
      'expired',
      'refunded',
      'partially_refunded'
    ) then
      update public.payments
      set status = 'paid',
          paid_at = coalesce(paid_at, v_now),
          provider_checkout_id = coalesce(
            nullif(p_provider_checkout_id, ''),
            provider_checkout_id
          ),
          provider_payment_id = coalesce(
            nullif(p_provider_payment_id, ''),
            provider_payment_id
          ),
          livemode = p_livemode,
          failure_message =
            'A linked booking is terminal. Successful Stripe payment requires manual resolution.',
          updated_at = v_now
      where id = p_payment_id;

      insert into public.order_events (
        order_id,
        event_type,
        actor_type,
        metadata
      )
      values (
        p_order_id,
        'payment_manual_resolution',
        'system',
        jsonb_build_object(
          'reason', 'Linked booking is terminal',
          'booking_id', v_booking.id,
          'booking_status', v_booking.status,
          'stripe_event_id', p_stripe_event_id,
          'payment_id', p_payment_id
        )
      );

      return jsonb_build_object(
        'status', 'requires_manual_resolution',
        'reason', 'terminal_linked_booking',
        'recovered', false
      );
    end if;
  end loop;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      provider_checkout_id = coalesce(
        nullif(p_provider_checkout_id, ''),
        provider_checkout_id
      ),
      provider_payment_id = coalesce(
        nullif(p_provider_payment_id, ''),
        provider_payment_id
      ),
      livemode = p_livemode,
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

  update public.bookings
  set status = 'confirmed',
      expires_at = null,
      confirmed_at = coalesce(confirmed_at, v_now),
      updated_at = v_now
  where order_id = p_order_id
    and status in ('pending', 'awaiting_payment');

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    metadata
  )
  select
    b.id,
    'confirmed',
    'system',
    jsonb_build_object(
      'via', 'confirm_order_from_stripe',
      'order_id', p_order_id,
      'stripe_event_id', p_stripe_event_id,
      'payment_id', p_payment_id
    )
  from public.bookings b
  where b.order_id = p_order_id
    and b.status = 'confirmed'
    and not exists (
      select 1
      from public.booking_events be
      where be.booking_id = b.id
        and be.event_type = 'confirmed'
        and be.metadata ->> 'stripe_event_id' = p_stripe_event_id
    );

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    p_order_id,
    'payment_received',
    'system',
    jsonb_build_object(
      'payment_id', p_payment_id,
      'stripe_event_id', p_stripe_event_id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'recovered', false
  );
end;
$$;

revoke all on function public.confirm_booking_from_stripe(
  uuid, uuid, text, text, text, integer, text, boolean
) from public, anon, authenticated;
revoke all on function public.confirm_order_from_stripe(
  uuid, uuid, text, text, text, integer, text, boolean
) from public, anon, authenticated;
grant execute on function public.confirm_booking_from_stripe(
  uuid, uuid, text, text, text, integer, text, boolean
) to service_role;
grant execute on function public.confirm_order_from_stripe(
  uuid, uuid, text, text, text, integer, text, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- State-regression-safe payment failure handling
-- ---------------------------------------------------------------------------

create or replace function public.fail_stripe_payment_attempt(
  p_payment_id uuid,
  p_provider_checkout_id text,
  p_provider_payment_id text,
  p_failure_code text,
  p_failure_message text,
  p_livemode boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_payment_id is not null then
    select *
    into v_payment
    from public.payments
    where id = p_payment_id
    for update;
  elsif nullif(p_provider_checkout_id, '') is not null then
    select *
    into v_payment
    from public.payments
    where provider_checkout_id = p_provider_checkout_id
    for update;
  elsif nullif(p_provider_payment_id, '') is not null then
    select *
    into v_payment
    from public.payments
    where provider_payment_id = p_provider_payment_id
    for update;
  else
    return jsonb_build_object('status', 'not_found', 'updated', false);
  end if;

  if not found or v_payment.provider <> 'stripe' then
    return jsonb_build_object('status', 'not_found', 'updated', false);
  end if;
  if nullif(p_provider_checkout_id, '') is not null
     and v_payment.provider_checkout_id is distinct from p_provider_checkout_id
  then
    return jsonb_build_object('status', 'stale_event', 'updated', false);
  end if;
  if nullif(p_provider_payment_id, '') is not null
     and v_payment.provider_payment_id is distinct from p_provider_payment_id
  then
    return jsonb_build_object('status', 'stale_event', 'updated', false);
  end if;
  if v_payment.livemode is not null
     and v_payment.livemode is distinct from p_livemode
  then
    raise exception 'Payment livemode mismatch';
  end if;
  if v_payment.status in ('paid', 'partially_refunded', 'refunded') then
    return jsonb_build_object(
      'status', 'terminal_payment',
      'updated', false,
      'payment_id', v_payment.id,
      'booking_id', v_payment.booking_id,
      'order_id', v_payment.order_id
    );
  end if;

  update public.payments
  set status = 'failed',
      failure_code = nullif(p_failure_code, ''),
      failure_message = left(coalesce(p_failure_message, 'Payment failed'), 500),
      livemode = p_livemode,
      updated_at = v_now
  where id = v_payment.id;

  return jsonb_build_object(
    'status', 'failed',
    'updated', true,
    'payment_id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'order_id', v_payment.order_id
  );
end;
$$;

revoke all on function public.fail_stripe_payment_attempt(
  uuid, text, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.fail_stripe_payment_attempt(
  uuid, text, text, text, text, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- Refund ledger synchronization. This intentionally does not allocate a mixed
-- order refund to individual items/bookings or release resources.
-- ---------------------------------------------------------------------------

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
      refund_reason = 'Synchronized from verified Stripe charge.refunded event',
      livemode = p_livemode,
      updated_at = v_now
  where id = v_payment.id;

  if v_payment.order_id is not null then
    update public.orders
    set payment_status = v_status,
        updated_at = v_now
    where id = v_payment.order_id;

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
        'requires_item_allocation_review', true
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
  end if;

  return jsonb_build_object(
    'status', v_status,
    'payment_id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'order_id', v_payment.order_id,
    'refunded_amount_grosz', p_refunded_amount_grosz,
    'requires_manual_resolution', true
  );
end;
$$;

revoke all on function public.sync_stripe_refund(
  text, integer, text, boolean, text
) from public, anon, authenticated;
grant execute on function public.sync_stripe_refund(
  text, integer, text, boolean, text
) to service_role;

create or replace function public.record_booking_refund_safe(
  p_payment_id uuid,
  p_refund_amount_grosz integer,
  p_expected_refunded_total_grosz integer,
  p_reason text,
  p_operation_key text,
  p_actor_type text,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_booking public.bookings;
  v_new_refunded integer;
  v_status text;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.booking_id is null or v_payment.order_id is not null then
    raise exception 'Payment is not a standalone booking payment';
  end if;
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Refund operation key is required';
  end if;
  if p_actor_type not in ('admin', 'customer', 'system') then
    raise exception 'Invalid refund actor type';
  end if;

  -- The payment-row lock serializes concurrent callers. A Stripe refund ID (or
  -- deterministic manual operation key) makes a local retry idempotent even
  -- when Stripe succeeded but the first application request lost its response.
  if exists (
    select 1
    from public.booking_events e
    where e.booking_id = v_payment.booking_id
      and e.event_type = 'refunded'
      and e.metadata ->> 'operation_key' = p_operation_key
  ) then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'booking_id', v_payment.booking_id,
      'status', v_payment.status,
      'refunded_amount_grosz', v_payment.refunded_amount_grosz,
      'booking_closed', v_payment.status = 'refunded',
      'already_recorded', true
    );
  end if;

  if p_refund_amount_grosz <= 0 then
    raise exception 'Refund amount must be positive';
  end if;
  if p_expected_refunded_total_grosz <= 0
     or p_expected_refunded_total_grosz > v_payment.amount_gross_grosz
  then
    raise exception 'Expected refunded total is invalid';
  end if;

  -- A charge/refund webhook can synchronize the authoritative cumulative
  -- amount before the initiating admin/customer request returns.
  if v_payment.refunded_amount_grosz >= p_expected_refunded_total_grosz then
    return jsonb_build_object(
      'payment_id', v_payment.id,
      'booking_id', v_payment.booking_id,
      'status', v_payment.status,
      'refunded_amount_grosz', v_payment.refunded_amount_grosz,
      'booking_closed', v_payment.status = 'refunded',
      'already_synchronized', true
    );
  end if;

  if v_payment.status not in ('paid', 'partially_refunded') then
    raise exception 'Payment cannot be refunded from status %', v_payment.status;
  end if;

  v_new_refunded := p_expected_refunded_total_grosz;
  if v_new_refunded <> v_payment.refunded_amount_grosz + p_refund_amount_grosz then
    raise exception 'Refund total changed concurrently; retry from current state';
  end if;
  v_status := case
    when v_new_refunded = v_payment.amount_gross_grosz then 'refunded'
    else 'partially_refunded'
  end;

  select *
  into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  update public.payments
  set refunded_amount_grosz = v_new_refunded,
      status = v_status,
      refund_reason = left(p_reason, 1000),
      updated_at = v_now
  where id = v_payment.id;

  -- A partial financial adjustment does not guess which participant was
  -- cancelled. A full refund closes the whole standalone booking.
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
    actor_id,
    actor_role,
    metadata
  )
  values (
    v_booking.id,
    'refunded',
    p_actor_type,
    p_actor_id,
    p_actor_role,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'operation_key', p_operation_key,
      'refund_amount_grosz', p_refund_amount_grosz,
      'refunded_amount_grosz', v_new_refunded,
      'refund_status', v_status,
      'booking_closed', v_status = 'refunded'
    )
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'booking_id', v_booking.id,
    'status', v_status,
    'refunded_amount_grosz', v_new_refunded,
    'booking_closed', v_status = 'refunded'
  );
end;
$$;

revoke all on function public.record_booking_refund_safe(
  uuid, integer, integer, text, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.record_booking_refund_safe(
  uuid, integer, integer, text, text, text, uuid, text
) to service_role;

create or replace function public.record_stripe_refund_failure(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_stripe_event_id text,
  p_failure_message text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_payment
  from public.payments
  where (
      p_payment_id is not null
      and id = p_payment_id
    )
    or (
      p_provider_payment_id is not null
      and provider_payment_id = p_provider_payment_id
    )
  order by
    case when id = p_payment_id then 0 else 1 end,
    created_at desc
  limit 1
  for update;
  if not found or v_payment.provider <> 'stripe' then
    return jsonb_build_object('status', 'unknown_payment');
  end if;

  update public.payments
  set failure_message = left(
        'Stripe refund failed: ' || coalesce(p_failure_message, 'unknown'),
        500
      ),
      updated_at = v_now
  where id = v_payment.id;

  if v_payment.order_id is not null then
    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      metadata
    )
    values (
      v_payment.order_id,
      'refund_failed',
      'system',
      jsonb_build_object(
        'payment_id', v_payment.id,
        'stripe_event_id', p_stripe_event_id,
        'requires_manual_resolution', true
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
        'reason', 'Stripe refund failed',
        'payment_id', v_payment.id,
        'stripe_event_id', p_stripe_event_id,
        'requires_manual_resolution', true
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'refund_failed',
    'payment_id', v_payment.id,
    'booking_id', v_payment.booking_id,
    'order_id', v_payment.order_id
  );
end;
$$;

revoke all on function public.record_stripe_refund_failure(
  uuid, text, text, text
)
  from public, anon, authenticated;
grant execute on function public.record_stripe_refund_failure(
  uuid, text, text, text
)
  to service_role;

-- Keep a cancellation reason on the protected booking row, but do not copy
-- unrestricted free text into the operational event/audit stream.
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_cancelled_by text,
  p_reason text,
  p_actor_id uuid default null,
  p_actor_role text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_now timestamptz := timezone('utc'::text, now());
  v_actor_type text;
begin
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status in (
    'cancelled',
    'expired',
    'refunded',
    'partially_refunded'
  ) then
    return jsonb_build_object(
      'already_cancelled', true,
      'status', v_booking.status
    );
  end if;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = left(coalesce(p_cancelled_by, 'system'), 100),
      cancellation_reason = left(p_reason, 1000),
      expires_at = null,
      updated_at = v_now
  where id = p_booking_id;

  update public.workshop_sessions
  set reserved_count = greatest(0, reserved_count - v_booking.quantity),
      updated_at = v_now
  where id = v_booking.workshop_session_id;

  v_actor_type := case
    when p_actor_id is not null then 'admin'
    when p_cancelled_by = 'customer' then 'customer'
    else 'system'
  end;

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_id,
    actor_role,
    metadata
  )
  values (
    p_booking_id,
    'cancelled',
    v_actor_type,
    p_actor_id,
    p_actor_role,
    jsonb_build_object(
      'previous_status', v_booking.status,
      'has_reason', nullif(trim(p_reason), '') is not null
    )
  );

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'cancelled'
  );
end;
$$;

revoke all on function public.cancel_booking(uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid, text, text, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Atomic manual confirmation and shipping quote operations
-- ---------------------------------------------------------------------------

create or replace function public.submit_cart_order_v2(
  p_idempotency_key text,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_marketing_consent boolean,
  p_terms_accepted_at timestamptz,
  p_privacy_policy_version text,
  p_lines jsonb,
  p_shipping_address jsonb,
  p_source text,
  p_selected_payment_method text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_order public.orders;
  v_order_id uuid;
  v_payment_id uuid;
  v_public_token text;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_selected_payment_method not in ('stripe', 'bank_transfer') then
    raise exception 'Unsupported payment method';
  end if;

  -- The nested function and all following updates share one PostgreSQL
  -- transaction. Any failure here rolls back capacity, inventory and order.
  v_result := public.submit_cart_order(
    p_idempotency_key,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_customer_notes,
    p_marketing_consent,
    p_terms_accepted_at,
    p_privacy_policy_version,
    p_lines,
    p_shipping_address,
    p_source
  );

  v_order_id := (v_result ->> 'order_id')::uuid;
  v_payment_id := nullif(v_result ->> 'payment_id', '')::uuid;
  v_public_token := nullif(v_result ->> 'public_lookup_token', '');

  select *
  into v_order
  from public.orders
  where id = v_order_id
  for update;
  if not found then
    raise exception 'Order not found after submission';
  end if;

  if coalesce((v_result ->> 'reused')::boolean, false)
     and v_order.selected_payment_method is not null
     and v_order.selected_payment_method <> p_selected_payment_method
  then
    raise exception 'Idempotency key belongs to a different payment method';
  end if;

  update public.orders
  set selected_payment_method = p_selected_payment_method,
      updated_at = v_now
  where id = v_order_id;

  if v_payment_id is not null then
    update public.payments
    set provider = case
          when p_selected_payment_method = 'stripe' then 'stripe'
          else 'bank_transfer'
        end,
        status = case
          when p_selected_payment_method = 'stripe' then 'created'
          else 'pending'
        end,
        updated_at = v_now
    where id = v_payment_id
      and status in ('created', 'pending');
  end if;

  if v_public_token is not null then
    insert into public.order_portal_token_recovery (
      order_id,
      public_lookup_token
    )
    values (
      v_order_id,
      v_public_token
    )
    on conflict (order_id) do nothing;
  else
    select nullif(t.public_lookup_token, '')
    into v_public_token
    from public.order_portal_token_recovery t
    where t.order_id = v_order_id;

    if v_public_token is not null then
      v_result := jsonb_set(
        v_result,
        '{public_lookup_token}',
        to_jsonb(v_public_token),
        true
      );
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.submit_cart_order_v2(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v2(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text
) to service_role;

create or replace function public.confirm_manual_booking_payment(
  p_booking_id uuid,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
  v_now timestamptz := timezone('utc'::text, now());
begin
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select *
  into v_payment
  from public.payments
  where booking_id = p_booking_id
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.provider = 'stripe' then
    raise exception 'Stripe payment cannot be confirmed manually';
  end if;
  if v_booking.status = 'confirmed' and v_payment.status = 'paid' then
    return jsonb_build_object('status', 'confirmed', 'already_confirmed', true);
  end if;
  if v_booking.status not in ('pending', 'awaiting_payment') then
    raise exception 'Booking cannot be manually confirmed from status %',
      v_booking.status;
  end if;
  if v_payment.status not in ('created', 'pending') then
    raise exception 'Payment cannot be manually confirmed from status %',
      v_payment.status;
  end if;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      failure_code = null,
      failure_message = null,
      updated_at = v_now
  where id = v_payment.id;

  update public.bookings
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, v_now),
      expires_at = null,
      updated_at = v_now
  where id = p_booking_id;

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_id,
    actor_role,
    metadata
  )
  values (
    p_booking_id,
    'confirmed',
    'admin',
    p_actor_id,
    p_actor_role,
    jsonb_build_object(
      'via', 'confirm_manual_booking_payment',
      'payment_id', v_payment.id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'payment_id', v_payment.id,
    'already_confirmed', false
  );
end;
$$;

create or replace function public.confirm_manual_order_payment(
  p_order_id uuid,
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
  if v_order.selected_payment_method = 'stripe' then
    raise exception 'Stripe order cannot be confirmed manually';
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Payment not found';
  end if;
  if v_payment.provider = 'stripe' then
    raise exception 'Stripe payment cannot be confirmed manually';
  end if;
  if v_order.payment_status = 'paid' and v_payment.status = 'paid' then
    return jsonb_build_object('status', 'confirmed', 'already_confirmed', true);
  end if;
  if v_order.status not in ('awaiting_payment', 'confirmed') then
    raise exception 'Order cannot be manually confirmed from status %',
      v_order.status;
  end if;
  if v_payment.status not in ('created', 'pending') then
    raise exception 'Payment cannot be manually confirmed from status %',
      v_payment.status;
  end if;
  if v_payment.amount_gross_grosz <> v_order.total_gross_grosz
     or v_payment.currency <> v_order.currency
  then
    raise exception 'Manual payment amount or currency mismatch';
  end if;

  update public.payments
  set status = 'paid',
      paid_at = coalesce(paid_at, v_now),
      failure_code = null,
      failure_message = null,
      updated_at = v_now
  where id = v_payment.id;

  update public.orders
  set status = 'confirmed',
      payment_status = 'paid',
      confirmed_at = coalesce(confirmed_at, v_now),
      expires_at = null,
      updated_at = v_now
  where id = p_order_id;

  update public.bookings
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, v_now),
      expires_at = null,
      updated_at = v_now
  where order_id = p_order_id
    and status in ('pending', 'awaiting_payment');

  insert into public.booking_events (
    booking_id,
    event_type,
    actor_type,
    actor_id,
    actor_role,
    metadata
  )
  select
    b.id,
    'confirmed',
    'admin',
    p_actor_id,
    p_actor_role,
    jsonb_build_object(
      'via', 'confirm_manual_order_payment',
      'order_id', p_order_id,
      'payment_id', v_payment.id
    )
  from public.bookings b
  where b.order_id = p_order_id
    and b.status = 'confirmed';

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  )
  values (
    p_order_id,
    'payment_received',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'via', 'confirm_manual_order_payment',
      'actor_role', p_actor_role,
      'payment_id', v_payment.id
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'payment_id', v_payment.id,
    'already_confirmed', false
  );
end;
$$;

create or replace function public.set_order_shipping_quote(
  p_order_id uuid,
  p_shipping_gross_grosz integer,
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
  v_total bigint;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_shipping_gross_grosz < 0 then
    raise exception 'Shipping fee cannot be negative';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;

  v_total := v_order.subtotal_gross_grosz::bigint
    + p_shipping_gross_grosz::bigint;
  if v_total > 2147483647 then
    raise exception 'Order total exceeds supported range';
  end if;

  if not v_order.shipping_quote_required then
    if v_order.shipping_gross_grosz = p_shipping_gross_grosz
       and v_order.total_gross_grosz = v_total
    then
      return jsonb_build_object(
        'status', 'confirmed',
        'already_confirmed', true,
        'total_gross_grosz', v_total
      );
    end if;
    raise exception 'Shipping quote is already confirmed';
  end if;
  if v_order.status <> 'awaiting_payment'
     or v_order.payment_status <> 'pending'
  then
    raise exception 'Order is not eligible for a shipping quote';
  end if;
  if exists (
    select 1
    from public.payments
    where order_id = p_order_id
      and (
        status in ('paid', 'partially_refunded', 'refunded')
        or provider_checkout_id is not null
        or provider_payment_id is not null
      )
  ) then
    raise exception 'A payment attempt already exists for this order';
  end if;

  update public.orders
  set shipping_gross_grosz = p_shipping_gross_grosz,
      total_gross_grosz = v_total::integer,
      shipping_quote_required = false,
      updated_at = v_now
  where id = p_order_id;

  update public.payments
  set amount_gross_grosz = v_total::integer,
      updated_at = v_now
  where order_id = p_order_id
    and status in ('created', 'pending', 'failed');

  insert into public.order_events (
    order_id,
    event_type,
    actor_type,
    actor_id,
    metadata
  )
  values (
    p_order_id,
    'shipping_quote_confirmed',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'actor_role', p_actor_role,
      'shipping_gross_grosz', p_shipping_gross_grosz,
      'total_gross_grosz', v_total
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'already_confirmed', false,
    'shipping_gross_grosz', p_shipping_gross_grosz,
    'total_gross_grosz', v_total
  );
end;
$$;

revoke all on function public.confirm_manual_booking_payment(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.confirm_manual_order_payment(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_order_shipping_quote(uuid, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_manual_booking_payment(uuid, uuid, text)
  to service_role;
grant execute on function public.confirm_manual_order_payment(uuid, uuid, text)
  to service_role;
grant execute on function public.set_order_shipping_quote(uuid, integer, uuid, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Safe cancellation for unpaid orders. Paid/refunded/partially fulfilled
-- orders require a separate refund/allocation decision.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_unpaid_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_reason text
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

  if v_order.status = 'cancelled' then
    return jsonb_build_object('status', 'cancelled', 'already_cancelled', true);
  end if;
  if v_order.status in ('expired', 'refunded', 'partially_refunded')
     or v_order.payment_status in ('paid', 'refunded', 'partially_refunded')
  then
    raise exception 'Paid or financially closed order cannot use unpaid cancellation';
  end if;
  if v_order.fulfillment_status in ('partial', 'fulfilled') then
    raise exception 'Partially or fully fulfilled order cannot be cancelled automatically';
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
      set status = 'cancelled',
          cancelled_at = v_now,
          cancelled_by = 'staff',
          cancellation_reason = left(coalesce(p_reason, 'Order cancelled'), 500),
          expires_at = null,
          updated_at = v_now
      where id = v_booking.id;

      insert into public.booking_events (
        booking_id,
        event_type,
        actor_type,
        actor_id,
        actor_role,
        metadata
      )
      values (
        v_booking.id,
        'cancelled',
        'admin',
        p_actor_id,
        p_actor_role,
        jsonb_build_object(
          'has_reason', nullif(trim(p_reason), '') is not null,
          'via', 'cancel_unpaid_order',
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
      failure_message = 'Order cancelled before payment',
      updated_at = v_now
  where order_id = p_order_id
    and status not in ('paid', 'partially_refunded', 'refunded');

  update public.orders
  set status = 'cancelled',
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
    actor_id,
    metadata
  )
  values (
    p_order_id,
    'cancelled',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'actor_role', p_actor_role,
      'has_reason', nullif(trim(p_reason), '') is not null,
      'via', 'cancel_unpaid_order'
    )
  );

  return jsonb_build_object(
    'status', 'cancelled',
    'already_cancelled', false
  );
end;
$$;

revoke all on function public.cancel_unpaid_order(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.cancel_unpaid_order(uuid, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Final atomic Checkout attempt preparation.
-- A stable DB attempt key is reused after a crashed Stripe API call.
-- ---------------------------------------------------------------------------

create or replace function public.prepare_order_checkout_attempt(
  p_order_id uuid,
  p_attempt_key text
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
  if nullif(trim(p_attempt_key), '') is null then
    raise exception 'Attempt key is required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.payment_status = 'paid'
     or exists (
       select 1
       from public.payments
       where order_id = p_order_id
         and status = 'paid'
     )
  then
    return jsonb_build_object('status', 'already_paid');
  end if;
  if v_order.status in (
    'cancelled',
    'expired',
    'refunded',
    'partially_refunded'
  ) then
    return jsonb_build_object('status', 'terminal');
  end if;
  if v_order.shipping_quote_required then
    return jsonb_build_object('status', 'shipping_quote_required');
  end if;
  if v_order.selected_payment_method is distinct from 'stripe' then
    return jsonb_build_object('status', 'wrong_payment_method');
  end if;

  select *
  into v_payment
  from public.payments
  where order_id = p_order_id
  order by created_at desc
  limit 1
  for update;

  if found
     and v_payment.provider = 'stripe'
     and v_payment.status = 'created'
     and v_payment.provider_checkout_id is null
     and v_payment.failure_message = 'stripe_checkout_creating'
  then
    if v_payment.updated_at > v_now - interval '2 minutes' then
      return jsonb_build_object(
        'status', 'creating',
        'payment_id', v_payment.id
      );
    end if;

    update public.payments
    set updated_at = v_now
    where id = v_payment.id;

    return jsonb_build_object(
      'status', 'claimed',
      'payment_id', v_payment.id,
      'stripe_idempotency_key', v_payment.idempotency_key,
      'recovered_stale_claim', true
    );
  end if;

  if found
     and v_payment.status in ('created', 'pending', 'failed', 'cancelled')
     and v_payment.status not in ('paid', 'partially_refunded', 'refunded')
  then
    update public.payments
    set provider = 'stripe',
        status = 'created',
        amount_gross_grosz = v_order.total_gross_grosz,
        currency = v_order.currency,
        provider_checkout_id = null,
        provider_payment_id = null,
        idempotency_key = p_attempt_key,
        failure_code = null,
        failure_message = 'stripe_checkout_creating',
        updated_at = v_now
    where id = v_payment.id;

    return jsonb_build_object(
      'status', 'claimed',
      'payment_id', v_payment.id,
      'stripe_idempotency_key', p_attempt_key,
      'recovered_stale_claim', false
    );
  end if;

  insert into public.payments (
    booking_id,
    order_id,
    provider,
    status,
    amount_gross_grosz,
    currency,
    idempotency_key,
    failure_message
  )
  values (
    null,
    p_order_id,
    'stripe',
    'created',
    v_order.total_gross_grosz,
    v_order.currency,
    p_attempt_key,
    'stripe_checkout_creating'
  )
  returning * into v_payment;

  return jsonb_build_object(
    'status', 'claimed',
    'payment_id', v_payment.id,
    'stripe_idempotency_key', p_attempt_key,
    'recovered_stale_claim', false
  );
end;
$$;

revoke all on function public.prepare_order_checkout_attempt(uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_order_checkout_attempt(uuid, text)
  to service_role;

comment on function public.confirm_booking_from_stripe is
  'Strictly confirms a standalone booking from an already verified Stripe object.';
comment on function public.confirm_order_from_stripe is
  'Strictly confirms a unified order from an already verified Stripe object.';
comment on function public.sync_stripe_refund is
  'Synchronizes authoritative Stripe cumulative refund totals without guessing item allocation.';
comment on function public.cancel_unpaid_order is
  'Atomically cancels an unpaid, unfulfilled order and releases capacity/inventory exactly once.';
comment on function public.prepare_order_checkout_attempt is
  'Atomically claims a fresh Stripe Checkout attempt or recovers a stale in-flight claim.';
comment on function public.submit_cart_order_v2 is
  'Atomically submits a cart order, persists its payment method and stores/recover its opaque portal token.';
