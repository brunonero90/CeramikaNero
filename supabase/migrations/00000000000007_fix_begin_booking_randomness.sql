-- Ceramika Nero — Phase 5 follow-up fix (2)
--
-- begin_booking in 00000000000005/00000000000006 still references an extension
-- function that is not available under the function's search_path on the hosted
-- Supabase project. This migration replaces that call with the built-in
-- gen_random_uuid() function, which does not require pgcrypto or the extensions
-- schema. All other behaviour is preserved.
--
-- This is a forward-only, additive migration. No data is modified.

-- Recreate begin_booking with a built-in random source for the idempotency key.
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

  if p_participants is null or jsonb_array_length(p_participants) != p_quantity then
    raise exception 'Participant count must match requested quantity';
  end if;

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

  v_unit_price := coalesce(v_session.price_gross_grosz, v_workshop.default_price_gross_grosz);
  if v_unit_price is null or v_unit_price < 0 then
    raise exception 'Session price is not configured';
  end if;
  v_total_price := v_unit_price * p_quantity;

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

  if p_status = 'confirmed' then
    v_confirmed_at := v_now;
    v_expires_at := null;
  elsif p_status = 'pending' then
    v_expires_at := v_now + interval '15 minutes';
  else
    v_expires_at := null;
  end if;

  insert into public.bookings (
    customer_id, workshop_session_id, status, quantity, unit_price_gross_grosz,
    total_price_gross_grosz, currency, customer_notes, internal_notes, source,
    terms_accepted_at, privacy_policy_version, expires_at, confirmed_at
  ) values (
    v_customer_id, p_session_id, p_status, p_quantity, v_unit_price, v_total_price,
    'PLN', p_customer_notes, p_internal_notes, p_source, p_terms_accepted_at,
    p_privacy_policy_version, v_expires_at, v_confirmed_at
  ) returning id, booking_reference into v_booking_id, v_reference;

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

  insert into public.payments (
    booking_id, provider, status, amount_gross_grosz, currency,
    idempotency_key
  ) values (
    v_booking_id, p_payment_provider, p_payment_status, v_total_price, 'PLN',
    gen_random_uuid()::text
  ) returning id into v_payment_id;

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

  update public.workshop_sessions
  set reserved_count = reserved_count + p_quantity,
      updated_at = v_now
  where id = p_session_id;

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

-- Re-apply least-privilege grants for the recreated function.
do $$
declare
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'begin_booking'
  loop
    execute format('revoke execute on function public.%I(%s) from public', fn.proname, fn.args);
    execute format('grant execute on function public.%I(%s) to service_role', fn.proname, fn.args);
  end loop;
end
$$;
