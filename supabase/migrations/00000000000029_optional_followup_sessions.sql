-- Ceramika Nero — optional follow-up booking mode hotfix.
-- Apply after migration 28.

alter table public.workshops
  add column if not exists offers_followup_session boolean not null default false;

update public.workshops
set offers_followup_session = true
where requires_followup_session = true;

-- Glina do Wina offers glazing, but the customer may book only the first stage.
update public.workshops
set offers_followup_session = true,
    requires_followup_session = false,
    updated_at = timezone('utc'::text, now())
where (slug in ('glina-do-wina', 'glinadowina') or lower(title) = 'glina do wina')
  and (followup_workshop_id is not null
       or nullif(trim(coalesce(followup_workshop_type, '')), '') is not null);

alter table public.workshops
  drop constraint if exists workshops_followup_configuration_check;
alter table public.workshops
  add constraint workshops_followup_configuration_check
  check (
    (not offers_followup_session and not requires_followup_session)
    or followup_workshop_id is not null
    or nullif(trim(followup_workshop_type), '') is not null
  );

alter table public.workshops
  drop constraint if exists workshops_required_followup_is_offered_check;
alter table public.workshops
  add constraint workshops_required_followup_is_offered_check
  check (not requires_followup_session or offers_followup_session);

comment on column public.workshops.offers_followup_session is
  'Shows eligible follow-up sessions during checkout. Selection may remain optional unless requires_followup_session is true.';

create or replace function public.set_workshop_operational_metadata_v2(
  p_workshop_id uuid,
  p_participant_audience text,
  p_collect_participant_age boolean,
  p_workshop_type text,
  p_offers_followup_session boolean,
  p_requires_followup_session boolean,
  p_followup_workshop_type text,
  p_followup_min_days integer,
  p_followup_max_days integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_offers boolean := coalesce(p_offers_followup_session, false)
    or coalesce(p_requires_followup_session, false);
begin
  update public.workshops
  set participant_audience = p_participant_audience,
      collect_participant_age = coalesce(p_collect_participant_age, false),
      workshop_type = nullif(trim(p_workshop_type), ''),
      offers_followup_session = v_offers,
      requires_followup_session = coalesce(p_requires_followup_session, false),
      followup_workshop_id = case
        when not v_offers then null
        when nullif(trim(coalesce(p_followup_workshop_type, '')), '')
             is distinct from followup_workshop_type then null
        else followup_workshop_id
      end,
      followup_workshop_type = case
        when v_offers then nullif(trim(coalesce(p_followup_workshop_type, '')), '')
        else null
      end,
      followup_min_days = case when v_offers then p_followup_min_days else null end,
      followup_max_days = case when v_offers then p_followup_max_days else null end,
      updated_at = timezone('utc'::text, now())
  where id = p_workshop_id;

  if not found then raise exception 'Workshop not found'; end if;
end;
$$;

revoke all on function public.set_workshop_operational_metadata_v2(
  uuid, text, boolean, text, boolean, boolean, text, integer, integer
) from public, anon;
grant execute on function public.set_workshop_operational_metadata_v2(
  uuid, text, boolean, text, boolean, boolean, text, integer, integer
) to authenticated, service_role;

create or replace function public.submit_cart_order_v5(
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
  p_selected_payment_method text,
  p_voucher_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_sid uuid;
  v_line jsonb;
  v_followup_line jsonb;
  v_primary_session public.workshop_sessions;
  v_primary_workshop public.workshops;
  v_followup_session public.workshop_sessions;
  v_followup_workshop public.workshops;
  v_followup_count integer;
  v_quantity integer;
  v_expected_type text;
  v_min_start timestamptz;
  v_max_start timestamptz;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be an array';
  end if;

  -- Lock every workshop session once, in UUID order, before checking any pair.
  for v_sid in
    select distinct (elem->>'session_id')::uuid
    from jsonb_array_elements(p_lines) elem
    where elem->>'type' = 'workshop_session'
      and nullif(elem->>'session_id', '') is not null
    order by 1
  loop
    perform 1
    from public.workshop_sessions
    where id = v_sid
    for update;
    if not found then raise exception 'Session not found'; end if;
  end loop;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and coalesce(value->>'link_role', 'primary') <> 'followup'
  loop
    select * into v_primary_session
    from public.workshop_sessions
    where id = (v_line->>'session_id')::uuid;

    select * into v_primary_workshop
    from public.workshops
    where id = v_primary_session.workshop_id;

    if not (v_primary_workshop.offers_followup_session or v_primary_workshop.requires_followup_session) then
      continue;
    end if;

    select count(*) into v_followup_count
    from jsonb_array_elements(p_lines) candidate
    where candidate->>'type' = 'workshop_session'
      and candidate->>'link_role' = 'followup'
      and candidate->>'linked_primary_session_id' = v_primary_session.id::text;

    if v_followup_count > 1 then
      raise exception 'Follow-up session may be selected at most once';
    end if;

    if v_followup_count = 0 then
      if v_primary_workshop.requires_followup_session then
        raise exception 'Follow-up session is required exactly once';
      end if;
      continue;
    end if;

    select value into v_followup_line
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and value->>'link_role' = 'followup'
      and value->>'linked_primary_session_id' = v_primary_session.id::text
    limit 1;

    if (v_followup_line->>'session_id')::uuid = v_primary_session.id then
      raise exception 'Follow-up session must differ from the primary session';
    end if;

    v_quantity := coalesce((v_line->>'quantity')::integer, 0);
    if coalesce((v_followup_line->>'quantity')::integer, 0) <> v_quantity then
      raise exception 'Follow-up quantity must match the primary quantity';
    end if;

    select * into v_followup_session
    from public.workshop_sessions
    where id = (v_followup_line->>'session_id')::uuid;

    select * into v_followup_workshop
    from public.workshops
    where id = v_followup_session.workshop_id;

    if v_primary_workshop.followup_workshop_id is not null then
      if v_followup_workshop.id <> v_primary_workshop.followup_workshop_id then
        raise exception 'Follow-up session does not match the configured workshop';
      end if;
    else
      v_expected_type := nullif(trim(v_primary_workshop.followup_workshop_type), '');
      if v_expected_type is null
         or (
           v_followup_workshop.workshop_type is distinct from v_expected_type
           and v_followup_workshop.slug is distinct from v_expected_type
         ) then
        raise exception 'Follow-up session does not match the configured workshop type';
      end if;
    end if;

    v_min_start := v_primary_session.starts_at
      + make_interval(days => coalesce(v_primary_workshop.followup_min_days, 0));
    v_max_start := v_primary_session.starts_at
      + make_interval(days => coalesce(v_primary_workshop.followup_max_days, 90));

    if v_followup_session.starts_at < v_min_start
       or v_followup_session.starts_at > v_max_start then
      raise exception 'Follow-up session is outside the configured date window';
    end if;

    if v_followup_workshop.status <> 'published'
       or v_followup_workshop.archived_at is not null
       or v_followup_workshop.booking_mode <> 'scheduled'
       or v_followup_session.status not in ('scheduled', 'sold_out')
       or v_followup_session.starts_at <= v_now
       or (
         v_followup_session.booking_opens_at is not null
         and v_followup_session.booking_opens_at > v_now
       )
       or (
         v_followup_session.booking_closes_at is not null
         and v_followup_session.booking_closes_at < v_now
       )
       or v_followup_session.capacity - v_followup_session.reserved_count < v_quantity then
      raise exception 'Follow-up session is no longer available';
    end if;
  end loop;

  -- Reject orphan/forged follow-up lines even though this RPC is service-only.
  for v_line in
    select value
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and value->>'link_role' = 'followup'
  loop
    select count(*) into v_followup_count
    from jsonb_array_elements(p_lines) primary_line
    join public.workshop_sessions primary_session
      on primary_session.id = nullif(primary_line->>'session_id', '')::uuid
    join public.workshops primary_workshop
      on primary_workshop.id = primary_session.workshop_id
    where primary_line->>'type' = 'workshop_session'
      and coalesce(primary_line->>'link_role', 'primary') <> 'followup'
      and primary_line->>'session_id' = v_line->>'linked_primary_session_id'
      and (primary_workshop.offers_followup_session or primary_workshop.requires_followup_session);

    if v_followup_count <> 1 then
      raise exception 'Follow-up session has no configured primary workshop';
    end if;
  end loop;

  return public.submit_cart_order_v4(
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
    p_source,
    p_selected_payment_method,
    p_voucher_code
  );
end;
$$;

revoke all on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) to service_role;

comment on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) is
  'Authoritatively locks and validates configured follow-up sessions before unified atomic checkout.';
