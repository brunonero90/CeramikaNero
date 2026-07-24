-- Ceramika Nero — Phase 5 booking and payment system
--
-- Adds operational tables, booking-lifecycle functions and admin RLS policies
-- required for public guest bookings, Stripe payments, manual/offline bookings,
-- cancellation, refunds, email tracking and webhook idempotency.
-- All changes are forward-only and additive; no existing data is modified.

-- ---------------------------------------------------------------------------
-- Booking and payment operational columns
-- ---------------------------------------------------------------------------

alter table public.bookings
add column if not exists cancelled_by text,
add column if not exists cancellation_reason text,
add column if not exists moved_from_session_id uuid references public.workshop_sessions(id) on delete set null,
add column if not exists moved_to_session_id uuid references public.workshop_sessions(id) on delete set null;

comment on column public.bookings.cancelled_by is
  'Who or what cancelled the booking: customer, staff, system, expiry.';
comment on column public.bookings.cancellation_reason is
  'Human-readable reason for cancellation, recorded for audits and support.';
comment on column public.bookings.moved_from_session_id is
  'Original session when a booking is moved to another session.';
comment on column public.bookings.moved_to_session_id is
  'Destination session when a booking is moved.';

alter table public.payments
add column if not exists refund_reason text;

comment on column public.payments.refund_reason is
  'Internal reason for a full or partial refund.';

-- ---------------------------------------------------------------------------
-- Operational tables
-- ---------------------------------------------------------------------------

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_type text not null check (event_type in ('reserved', 'confirmed', 'expired', 'cancelled', 'refunded', 'moved', 'email_sent', 'email_failed', 'payment_failed', 'note')),
  actor_type text not null check (actor_type in ('system', 'customer', 'admin')),
  actor_id uuid,
  actor_role text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.booking_events is
  'Operational event log for bookings. Stores safe, non-sensitive metadata only.';

comment on column public.booking_events.metadata is
  'Safe operational context such as quantities, amounts and session IDs. Never store passwords, full tokens or raw personal data.';

create index idx_booking_events_booking on public.booking_events (booking_id, created_at desc);
create index idx_booking_events_type on public.booking_events (event_type);

alter table public.booking_events enable row level security;

create policy "Managers and owners can view booking events"
  on public.booking_events for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

-- Service role (server-only secret key) can fully manage operational tables.
create policy "Service role can manage booking events"
  on public.booking_events for all
  to service_role
  using (true)
  with check (true);

create table public.booking_cancellation_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.booking_cancellation_tokens is
  'Hashed, time-limited cancellation tokens sent to customers by email.';

create unique index idx_booking_cancellation_tokens_hash on public.booking_cancellation_tokens (token_hash);
create index idx_booking_cancellation_tokens_booking on public.booking_cancellation_tokens (booking_id);

alter table public.booking_cancellation_tokens enable row level security;

create policy "Service role can manage cancellation tokens"
  on public.booking_cancellation_tokens for all
  to service_role
  using (true)
  with check (true);

create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.stripe_events is
  'Deduplicates Stripe webhook events. Each event_id is processed at most once.';

create index idx_stripe_events_event_id on public.stripe_events (event_id);

alter table public.stripe_events enable row level security;

create policy "Service role can manage stripe events"
  on public.stripe_events for all
  to service_role
  using (true)
  with check (true);

create table public.booking_emails (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  email_type text not null check (email_type in ('confirmation', 'cancellation', 'refund', 'manual_confirmation', 'payment_problem')),
  status text not null check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.booking_emails is
  'Tracks transactional email delivery attempts for idempotency and retry.';

create index idx_booking_emails_booking on public.booking_emails (booking_id, created_at desc);
create index idx_booking_emails_type on public.booking_emails (email_type, status);

alter table public.booking_emails enable row level security;

create policy "Managers and owners can view booking emails"
  on public.booking_emails for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Service role can manage booking emails"
  on public.booking_emails for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- updated_at trigger for booking_emails
-- ---------------------------------------------------------------------------

create trigger trg_booking_emails_updated_at
before update on public.booking_emails for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin RLS policies for existing booking tables
-- ---------------------------------------------------------------------------

-- Already created in 00000000000000_initial_schema.sql; create conditionally
-- so the migration remains idempotent when rerun against a schema that already
-- includes it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_profiles'
      and policyname = 'No public customer access'
  ) then
    create policy "No public customer access"
      on public.customer_profiles for select
      using (false);
  end if;
end
$$;

create policy "Managers and owners can manage customer profiles"
  on public.customer_profiles for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage bookings"
  on public.bookings for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage booking participants"
  on public.booking_participants for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage payments"
  on public.payments for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

-- ---------------------------------------------------------------------------
-- Booking lifecycle functions
-- ---------------------------------------------------------------------------

-- Atomic public/admin booking creation. Reserves capacity, creates the customer,
-- booking, participants and payment in a single transaction.
create or replace function public.begin_booking(
  p_session_id uuid,
  p_quantity int,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_marketing_consent boolean,
  p_terms_accepted_at timestamptz,
  p_privacy_policy_version text,
  p_participants jsonb,
  p_source text,
  p_payment_provider text,
  p_payment_status text,
  p_admin_user_id uuid default null,
  p_internal_notes text default null,
  p_status text default 'pending'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.workshop_sessions;
  v_workshop public.workshops;
  v_category public.workshop_categories;
  v_customer_id uuid;
  v_unit_price int;
  v_total_price int;
  v_booking_id uuid;
  v_payment_id uuid;
  v_reference text;
  v_expires_at timestamptz;
  v_confirmed_at timestamptz;
  v_now timestamptz;
  v_participant jsonb;
  v_available_quantity int;
  v_age int;
  v_count int;
begin
  v_now := timezone('utc'::text, now());

  -- Lock session and related workshop
  select * into v_session
  from public.workshop_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  select * into v_workshop
  from public.workshops
  where id = v_session.workshop_id
  for share;

  if not found then
    raise exception 'Workshop not found';
  end if;

  select * into v_category
  from public.workshop_categories
  where id = v_workshop.category_id
  for share;

  -- Validate bookability
  if v_workshop.status != 'published' or v_workshop.archived_at is not null then
    raise exception 'Workshop is not available for booking';
  end if;

  if v_workshop.booking_mode != 'scheduled' then
    raise exception 'Workshop does not support internal booking';
  end if;

  if v_session.status not in ('scheduled', 'sold_out') then
    raise exception 'Session is not open for booking';
  end if;

  if v_session.starts_at <= v_now then
    raise exception 'Session has already started or passed';
  end if;

  if v_session.booking_opens_at is not null and v_session.booking_opens_at > v_now then
    raise exception 'Booking is not yet open';
  end if;

  if v_session.booking_closes_at is not null and v_session.booking_closes_at < v_now then
    raise exception 'Booking has closed';
  end if;

  if p_quantity <= 0 or p_quantity > 10 then
    raise exception 'Invalid quantity. Must be between 1 and 10.';
  end if;

  v_available_quantity := v_session.capacity - v_session.reserved_count;
  if v_available_quantity < p_quantity then
    raise exception 'Insufficient capacity';
  end if;

  -- Participant count must match requested quantity
  if p_participants is null or jsonb_array_length(p_participants) != p_quantity then
    raise exception 'Participant count must match requested quantity';
  end if;

  -- Validate ages when the workshop has age restrictions
  if v_workshop.minimum_age is not null or v_workshop.maximum_age is not null then
    for v_participant in select * from jsonb_array_elements(p_participants)
    loop
      if (v_participant->>'age') is null or (v_participant->>'age') = '' then
        raise exception 'Participant age is required for this workshop';
      end if;
      v_age := (v_participant->>'age')::int;
      if v_age < coalesce(v_workshop.minimum_age, 0) or
         v_age > coalesce(v_workshop.maximum_age, 999) then
        raise exception 'Participant age is outside workshop limits';
      end if;
    end loop;
  end if;

  -- Determine authoritative price from the session (not the browser)
  v_unit_price := coalesce(v_session.price_gross_grosz, v_workshop.default_price_gross_grosz);
  if v_unit_price is null or v_unit_price < 0 then
    raise exception 'Session price is not configured';
  end if;
  v_total_price := v_unit_price * p_quantity;

  -- Upsert customer profile by email (guest checkout does not require Auth)
  insert into public.customer_profiles (
    email, first_name, last_name, phone, marketing_consent, marketing_consent_at,
    privacy_policy_version
  ) values (
    lower(trim(p_customer_email)),
    trim(p_customer_first_name),
    trim(p_customer_last_name),
    nullif(trim(p_customer_phone), ''),
    p_marketing_consent,
    case when p_marketing_consent then v_now else null end,
    p_privacy_policy_version
  )
  on conflict (lower(email)) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    marketing_consent = excluded.marketing_consent,
    marketing_consent_at = excluded.marketing_consent_at,
    privacy_policy_version = excluded.privacy_policy_version,
    updated_at = v_now
  returning id into v_customer_id;

  -- Determine lifecycle timestamps
  if p_status = 'confirmed' then
    v_confirmed_at := v_now;
    v_expires_at := null;
  elsif p_status = 'pending' then
    v_expires_at := v_now + interval '15 minutes';
  else
    v_expires_at := null;
  end if;

  -- Insert booking
  insert into public.bookings (
    customer_id, workshop_session_id, status, quantity, unit_price_gross_grosz,
    total_price_gross_grosz, currency, customer_notes, internal_notes, source,
    terms_accepted_at, privacy_policy_version, expires_at, confirmed_at
  ) values (
    v_customer_id, p_session_id, p_status, p_quantity, v_unit_price, v_total_price,
    'PLN', p_customer_notes, p_internal_notes, p_source, p_terms_accepted_at,
    p_privacy_policy_version, v_expires_at, v_confirmed_at
  ) returning id, booking_reference into v_booking_id, v_reference;

  -- Insert participants
  insert into public.booking_participants (
    booking_id, display_name, age, participant_type, accessibility_notes
  )
  select
    v_booking_id,
    nullif(trim(elem->>'display_name'), ''),
    nullif(elem->>'age', '')::int,
    coalesce(elem->>'participant_type', 'unspecified'),
    nullif(elem->>'accessibility_notes', '')
  from jsonb_array_elements(p_participants) as elem;

  -- Insert payment
  insert into public.payments (
    booking_id, provider, status, amount_gross_grosz, currency,
    idempotency_key
  ) values (
    v_booking_id, p_payment_provider, p_payment_status, v_total_price, 'PLN',
    encode(gen_random_bytes(16), 'hex')
  ) returning id into v_payment_id;

  -- Increment reserved_count
  update public.workshop_sessions
  set reserved_count = reserved_count + p_quantity,
      updated_at = v_now
  where id = p_session_id;

  -- Record operational event
  insert into public.booking_events (
    booking_id, event_type, actor_type, actor_id, metadata
  ) values (
    v_booking_id,
    'reserved',
    case when p_admin_user_id is not null then 'admin' else 'customer' end,
    p_admin_user_id,
    jsonb_build_object(
      'quantity', p_quantity,
      'unit_price_gross_grosz', v_unit_price,
      'total_price_gross_grosz', v_total_price,
      'payment_provider', p_payment_provider,
      'payment_status', p_payment_status,
      'source', p_source
    )
  );

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'booking_reference', v_reference,
    'total_price_gross_grosz', v_total_price,
    'amount_to_pay_gross_grosz', v_total_price,
    'currency', 'PLN',
    'expires_at', v_expires_at,
    'confirmed_at', v_confirmed_at
  );
end;
$$;

comment on function public.begin_booking(uuid, int, text, text, text, text, text, boolean, timestamptz, text, jsonb, text, text, text, uuid, text, text) is
  'Atomically creates a booking, customer profile, participants, payment and reserves session capacity. All prices are resolved server-side from the session/workshop.';

-- Idempotently expire pending bookings whose 15-minute hold has passed.
create or replace function public.expire_pending_bookings()
returns table(booking_id uuid, booking_reference text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz;
  v_booking record;
begin
  v_now := timezone('utc'::text, now());

  for v_booking in
    select b.id, b.booking_reference, b.quantity, b.workshop_session_id
    from public.bookings b
    where b.status = 'pending'
      and b.expires_at is not null
      and b.expires_at < v_now
    order by b.expires_at
    for update
  loop
    update public.bookings
    set status = 'expired',
        updated_at = v_now
    where id = v_booking.id;

    update public.workshop_sessions
    set reserved_count = greatest(0, reserved_count - v_booking.quantity),
        updated_at = v_now
    where id = v_booking.workshop_session_id;

    insert into public.booking_events (
      booking_id, event_type, actor_type, metadata
    ) values (
      v_booking.id,
      'expired',
      'system',
      jsonb_build_object('reason', 'Reservation expired')
    );

    booking_id := v_booking.id;
    booking_reference := v_booking.booking_reference;
    return next;
  end loop;
end;
$$;

comment on function public.expire_pending_bookings() is
  'Expires pending bookings past their expires_at and releases capacity exactly once. Safe under concurrent calls.';

-- Confirm a booking from a verified payment (Stripe webhook). Reacquires capacity
-- if the booking expired between reservation and payment completion.
create or replace function public.confirm_booking_from_payment(
  p_booking_id uuid,
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
  v_booking public.bookings;
  v_payment public.payments;
  v_session public.workshop_sessions;
  v_now timestamptz;
  v_available int;
begin
  v_now := timezone('utc'::text, now());

  -- Idempotency: already processed this Stripe event?
  if exists (select 1 from public.stripe_events where event_id = p_stripe_event_id) then
    return jsonb_build_object('already_processed', true);
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if p_amount_gross_grosz != v_payment.amount_gross_grosz then
    raise exception 'Payment amount mismatch: expected %, got %', v_payment.amount_gross_grosz, p_amount_gross_grosz;
  end if;

  -- Already confirmed: just mark payment paid and record the event
  if v_booking.status = 'confirmed' then
    if v_payment.status != 'paid' then
      update public.payments
      set status = 'paid', paid_at = v_now, provider_payment_id = p_provider_payment_id,
          updated_at = v_now
      where id = p_payment_id;
    end if;
    insert into public.stripe_events (event_id, event_type) values (p_stripe_event_id, 'checkout.session.completed');
    return jsonb_build_object('status', 'confirmed', 'recovered', false);
  end if;

  -- Terminal booking states: payment succeeded but the booking cannot be confirmed
  if v_booking.status in ('cancelled', 'refunded', 'partially_refunded') then
    update public.payments
    set status = 'paid', paid_at = v_now, provider_payment_id = p_provider_payment_id,
        failure_message = 'Booking is in a terminal state. Requires manual resolution.',
        updated_at = v_now
    where id = p_payment_id;

    insert into public.booking_events (booking_id, event_type, actor_type, metadata)
    values (p_booking_id, 'payment_failed', 'system', jsonb_build_object('reason', 'Booking is in a terminal state', 'stripe_event_id', p_stripe_event_id));

    insert into public.stripe_events (event_id, event_type) values (p_stripe_event_id, 'checkout.session.completed');
    return jsonb_build_object('status', 'requires_manual_resolution', 'recovered', false);
  end if;

  if v_booking.status not in ('pending', 'awaiting_payment', 'expired') then
    raise exception 'Booking cannot be confirmed from status %', v_booking.status;
  end if;

  -- If the hold expired, try to reacquire capacity before confirming
  if v_booking.status = 'expired' then
    select * into v_session from public.workshop_sessions where id = v_booking.workshop_session_id for update;
    v_available := v_session.capacity - v_session.reserved_count;
    if v_available < v_booking.quantity then
      update public.payments
      set status = 'paid', paid_at = v_now, provider_payment_id = p_provider_payment_id,
          failure_message = 'Booking expired and capacity unavailable. Requires manual resolution.',
          updated_at = v_now
      where id = p_payment_id;

      insert into public.booking_events (booking_id, event_type, actor_type, metadata)
      values (p_booking_id, 'payment_failed', 'system', jsonb_build_object('reason', 'Expired and capacity unavailable', 'stripe_event_id', p_stripe_event_id));

      insert into public.stripe_events (event_id, event_type) values (p_stripe_event_id, 'checkout.session.completed');
      return jsonb_build_object('status', 'requires_manual_resolution', 'recovered', false);
    end if;

    update public.workshop_sessions
    set reserved_count = reserved_count + v_booking.quantity,
        updated_at = v_now
    where id = v_booking.workshop_session_id;
  end if;

  update public.bookings
  set status = 'confirmed', confirmed_at = v_now, expires_at = null, updated_at = v_now
  where id = p_booking_id;

  update public.payments
  set status = 'paid', paid_at = v_now, provider_payment_id = p_provider_payment_id,
      updated_at = v_now
  where id = p_payment_id;

  insert into public.booking_events (booking_id, event_type, actor_type, metadata)
  values (p_booking_id, 'confirmed', 'system', jsonb_build_object('stripe_event_id', p_stripe_event_id));

  insert into public.stripe_events (event_id, event_type) values (p_stripe_event_id, 'checkout.session.completed');

  return jsonb_build_object('status', 'confirmed', 'recovered', v_booking.status = 'expired');
end;
$$;

comment on function public.confirm_booking_from_payment(uuid, uuid, text, text, int) is
  'Idempotently confirms a booking after a verified Stripe payment. Reacquires capacity if the reservation expired before payment.';

-- Cancel a booking and release capacity. Idempotent for already-terminal states.
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
  v_session_id uuid;
  v_now timestamptz;
begin
  v_now := timezone('utc'::text, now());

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status in ('cancelled', 'expired') then
    return jsonb_build_object('already_cancelled', true, 'status', v_booking.status);
  end if;

  if v_booking.status in ('refunded', 'partially_refunded') then
    -- Already financially closed; do not release capacity again
    return jsonb_build_object('already_cancelled', true, 'status', v_booking.status);
  end if;

  v_session_id := v_booking.workshop_session_id;

  update public.bookings
  set status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = p_cancelled_by,
      cancellation_reason = p_reason,
      expires_at = null,
      updated_at = v_now
  where id = p_booking_id;

  update public.workshop_sessions
  set reserved_count = greatest(0, reserved_count - v_booking.quantity),
      updated_at = v_now
  where id = v_session_id;

  insert into public.booking_events (booking_id, event_type, actor_type, actor_id, actor_role, metadata)
  values (p_booking_id, 'cancelled', case when p_actor_id is null then 'customer' else 'admin' end, p_actor_id, p_actor_role, jsonb_build_object('reason', p_reason, 'previous_status', v_booking.status));

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'cancelled');
end;
$$;

comment on function public.cancel_booking(uuid, text, text, uuid, text) is
  'Cancels a booking and releases capacity exactly once. Idempotent for already-terminal states.';

-- Record a Stripe (or manual) refund against a payment, guarding the cumulative limit.
create or replace function public.record_payment_refund(
  p_payment_id uuid,
  p_refund_amount_grosz int,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_new_refunded int;
  v_new_status text;
  v_booking_id uuid;
  v_now timestamptz;
begin
  v_now := timezone('utc'::text, now());

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if p_refund_amount_grosz <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  v_new_refunded := v_payment.refunded_amount_grosz + p_refund_amount_grosz;
  if v_new_refunded > v_payment.amount_gross_grosz then
    raise exception 'Refund amount % would exceed payment %', v_new_refunded, v_payment.amount_gross_grosz;
  end if;

  v_new_status := case
    when v_new_refunded = v_payment.amount_gross_grosz then 'refunded'
    else 'partially_refunded'
  end;

  update public.payments
  set refunded_amount_grosz = v_new_refunded,
      status = v_new_status,
      refund_reason = p_reason,
      updated_at = v_now
  where id = p_payment_id;

  v_booking_id := v_payment.booking_id;
  update public.bookings
  set status = v_new_status,
      updated_at = v_now
  where id = v_booking_id and status not in ('cancelled', 'expired');

  insert into public.booking_events (booking_id, event_type, actor_type, metadata)
  values (v_booking_id, 'refunded', 'system', jsonb_build_object('refund_amount_grosz', p_refund_amount_grosz, 'reason', p_reason, 'payment_id', p_payment_id));

  return jsonb_build_object('payment_id', p_payment_id, 'refunded_amount_grosz', v_new_refunded, 'status', v_new_status);
end;
$$;

comment on function public.record_payment_refund(uuid, int, text) is
  'Records a refund against a payment, preventing cumulative refunds from exceeding the captured amount.';

-- Move a confirmed booking to a compatible future session. Preserves payment history.
-- Rejects moves between sessions with different prices to avoid unsafe automatic charging/refunding.
create or replace function public.move_booking(
  p_booking_id uuid,
  p_destination_session_id uuid,
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
  v_source public.workshop_sessions;
  v_dest public.workshop_sessions;
  v_dest_workshop public.workshops;
  v_now timestamptz;
  v_available int;
  v_old_price int;
  v_new_price int;
begin
  v_now := timezone('utc'::text, now());

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_booking.status not in ('confirmed', 'awaiting_payment') then
    raise exception 'Booking cannot be moved from status %', v_booking.status;
  end if;

  select * into v_source from public.workshop_sessions where id = v_booking.workshop_session_id for update;
  select * into v_dest from public.workshop_sessions where id = p_destination_session_id for update;
  select * into v_dest_workshop from public.workshops where id = v_dest.workshop_id for share;

  if not found then
    raise exception 'Destination session not found';
  end if;

  if v_dest.id = v_source.id then
    raise exception 'Destination session is the same as the source';
  end if;

  if v_dest.workshop_id != v_source.workshop_id then
    raise exception 'Cannot move booking between different workshops';
  end if;

  if v_dest.status not in ('scheduled', 'sold_out') then
    raise exception 'Destination session is not open for booking';
  end if;

  if v_dest.starts_at <= v_now then
    raise exception 'Destination session has already started or passed';
  end if;

  v_available := v_dest.capacity - v_dest.reserved_count;
  if v_available < v_booking.quantity then
    raise exception 'Insufficient capacity on destination session';
  end if;

  v_old_price := coalesce(v_source.price_gross_grosz, v_booking.unit_price_gross_grosz);
  v_new_price := coalesce(v_dest.price_gross_grosz, v_booking.unit_price_gross_grosz);
  if v_old_price != v_new_price then
    raise exception 'Cannot move between sessions with different prices';
  end if;

  -- Release source, reserve destination
  update public.workshop_sessions
  set reserved_count = greatest(0, reserved_count - v_booking.quantity),
      updated_at = v_now
  where id = v_source.id;

  update public.workshop_sessions
  set reserved_count = reserved_count + v_booking.quantity,
      updated_at = v_now
  where id = v_dest.id;

  update public.bookings
  set workshop_session_id = v_dest.id,
      moved_from_session_id = v_source.id,
      moved_to_session_id = v_dest.id,
      updated_at = v_now
  where id = p_booking_id;

  insert into public.booking_events (booking_id, event_type, actor_type, actor_id, actor_role, metadata)
  values (p_booking_id, 'moved', 'admin', p_actor_id, p_actor_role, jsonb_build_object('from_session_id', v_source.id, 'to_session_id', v_dest.id));

  return jsonb_build_object('booking_id', p_booking_id, 'destination_session_id', v_dest.id);
end;
$$;

comment on function public.move_booking(uuid, uuid, uuid, text) is
  'Atomically moves a booking to another session of the same workshop. Rejects price-differing sessions.';

-- Create a hashed, time-limited cancellation token for a customer.
create or replace function public.create_cancellation_token(p_booking_id uuid, p_expires_at timestamptz)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token text;
  v_hash text;
begin
  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.booking_cancellation_tokens (booking_id, token_hash, expires_at)
  values (p_booking_id, v_hash, p_expires_at);

  return v_token;
end;
$$;

comment on function public.create_cancellation_token(uuid, timestamptz) is
  'Creates a secure, hashed cancellation token for a booking. Returns the plaintext token to be emailed once.';

-- Verify and consume a cancellation token.
create or replace function public.verify_cancellation_token(p_booking_id uuid, p_token text)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_hash text;
  v_record public.booking_cancellation_tokens;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_record
  from public.booking_cancellation_tokens
  where token_hash = v_hash and booking_id = p_booking_id
  for update;

  if not found then
    return false;
  end if;

  if v_record.used_at is not null or v_record.expires_at < timezone('utc'::text, now()) then
    return false;
  end if;

  update public.booking_cancellation_tokens
  set used_at = timezone('utc'::text, now())
  where id = v_record.id;

  return true;
end;
$$;

comment on function public.verify_cancellation_token(uuid, text) is
  'Verifies a cancellation token, marks it used and returns true if valid.';

-- Record an email delivery attempt without leaking content.
create or replace function public.record_booking_email(
  p_booking_id uuid,
  p_email_type text,
  p_status text,
  p_provider_message_id text default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_now timestamptz;
begin
  v_now := timezone('utc'::text, now());

  insert into public.booking_emails (booking_id, email_type, status, provider_message_id, error_message, sent_at)
  values (p_booking_id, p_email_type, p_status, p_provider_message_id, p_error_message, case when p_status = 'sent' then v_now else null end)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.record_booking_email(uuid, text, text, text, text) is
  'Records a transactional email delivery attempt for a booking.';

-- ---------------------------------------------------------------------------
-- Least-privilege grants: restrict new functions to the service role
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'begin_booking',
        'expire_pending_bookings',
        'confirm_booking_from_payment',
        'cancel_booking',
        'record_payment_refund',
        'move_booking',
        'create_cancellation_token',
        'verify_cancellation_token',
        'record_booking_email'
      )
  loop
    execute format('revoke execute on function public.%I(%s) from public', fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to service_role', fn.proname, fn.args);
  end loop;
end
$$;
