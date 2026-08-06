-- Ceramika Nero — final linked-workshop and reminder hardening.
-- Apply after migration 27.

-- Preserve the attendance event introduced by migration 18 while extending the
-- same constraint with linked-workshop and reminder events.
alter table public.booking_events
  drop constraint if exists booking_events_event_type_check;
alter table public.booking_events
  add constraint booking_events_event_type_check
  check (
    event_type in (
      'reserved', 'confirmed', 'expired', 'cancelled', 'refunded', 'moved',
      'email_sent', 'email_failed', 'payment_failed', 'note',
      'attendance_updated',
      'reminder_queued', 'reminder_sent', 'reminder_skipped', 'linked'
    )
  );

alter table public.workshops
  drop constraint if exists workshops_followup_not_self_check;
alter table public.workshops
  add constraint workshops_followup_not_self_check
  check (followup_workshop_id is null or followup_workshop_id <> id);

-- Keep an exact follow-up ID while its type remains unchanged. If an admin
-- changes the type, clear the old exact ID so the new type actually takes
-- effect. Disabling follow-up also clears the exact relationship.
create or replace function public.set_workshop_operational_metadata(
  p_workshop_id uuid,
  p_participant_audience text,
  p_collect_participant_age boolean,
  p_workshop_type text,
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
begin
  update public.workshops
  set participant_audience = p_participant_audience,
      collect_participant_age = coalesce(p_collect_participant_age, false),
      workshop_type = nullif(trim(p_workshop_type), ''),
      requires_followup_session = coalesce(p_requires_followup_session, false),
      followup_workshop_id = case
        when not coalesce(p_requires_followup_session, false) then null
        when nullif(trim(coalesce(p_followup_workshop_type, '')), '')
             is distinct from followup_workshop_type then null
        else followup_workshop_id
      end,
      followup_workshop_type = case
        when coalesce(p_requires_followup_session, false)
          then nullif(trim(coalesce(p_followup_workshop_type, '')), '')
        else null
      end,
      followup_min_days = case
        when coalesce(p_requires_followup_session, false) then p_followup_min_days
        else null
      end,
      followup_max_days = case
        when coalesce(p_requires_followup_session, false) then p_followup_max_days
        else null
      end,
      updated_at = timezone('utc'::text, now())
  where id = p_workshop_id;

  if not found then raise exception 'Workshop not found'; end if;
end;
$$;

-- Queue reminders in a broad recovery window, but use next_attempt_at to send
-- at the precise 24-hour point. Existing unsent rows follow session moves.
create or replace function public.enqueue_booking_reminders(
  p_window_start timestamptz default null,
  p_window_end timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_start timestamptz;
  v_end timestamptz;
  v_queued integer := 0;
  v_rescheduled integer := 0;
  v_skipped integer := 0;
begin
  v_start := coalesce(p_window_start, v_now + interval '23 hours');
  v_end := coalesce(p_window_end, v_now + interval '25 hours');

  if v_end <= v_start then
    raise exception 'Reminder window end must be after start';
  end if;

  with moved as (
    update public.booking_emails e
    set scheduled_for = s.starts_at - interval '24 hours',
        next_attempt_at = greatest(v_now, s.starts_at - interval '24 hours'),
        claimed_at = null,
        status = 'pending',
        error_message = null,
        updated_at = v_now
    from public.bookings b
    join public.workshop_sessions s on s.id = b.workshop_session_id
    where e.booking_id = b.id
      and e.email_type = 'reminder'
      and e.status in ('pending', 'failed')
      and b.status = 'confirmed'
      and s.status in ('scheduled', 'sold_out')
      and e.scheduled_for is distinct from s.starts_at - interval '24 hours'
      and (
        e.error_message is null
        or e.error_message not ilike '%permanent%'
      )
    returning e.booking_id, e.scheduled_for
  ), logged as (
    insert into public.booking_events (booking_id, event_type, actor_type, metadata)
    select booking_id, 'reminder_queued', 'system',
      jsonb_build_object(
        'scheduled_for', scheduled_for,
        'reason', 'session_rescheduled'
      )
    from moved
    returning booking_id
  )
  select count(*) into v_rescheduled from logged;

  with invalid as (
    update public.booking_emails e
    set status = 'failed',
        claimed_at = null,
        next_attempt_at = null,
        error_message = 'permanent: booking no longer eligible for reminder',
        updated_at = v_now
    from public.bookings b
    where e.booking_id = b.id
      and e.email_type = 'reminder'
      and e.status in ('pending', 'failed')
      and b.status in ('cancelled', 'expired', 'refunded', 'partially_refunded')
      and (
        e.error_message is null
        or e.error_message not ilike '%permanent%'
      )
    returning e.booking_id
  ), logged as (
    insert into public.booking_events (booking_id, event_type, actor_type, metadata)
    select distinct booking_id, 'reminder_skipped', 'system',
      jsonb_build_object('reason', 'booking_terminal_before_send')
    from invalid
    returning booking_id
  )
  select count(*) into v_skipped from logged;

  with candidates as (
    select b.id as booking_id, s.starts_at
    from public.bookings b
    join public.workshop_sessions s on s.id = b.workshop_session_id
    where b.status = 'confirmed'
      and s.status in ('scheduled', 'sold_out')
      and s.starts_at >= v_start
      and s.starts_at < v_end
  ), inserted as (
    insert into public.booking_emails (
      booking_id, email_type, status, scheduled_for,
      attempt_count, next_attempt_at, claimed_at
    )
    select
      c.booking_id,
      'reminder',
      'pending',
      c.starts_at - interval '24 hours',
      0,
      greatest(v_now, c.starts_at - interval '24 hours'),
      null
    from candidates c
    on conflict do nothing
    returning booking_id, scheduled_for
  ), logged as (
    insert into public.booking_events (booking_id, event_type, actor_type, metadata)
    select booking_id, 'reminder_queued', 'system',
      jsonb_build_object('scheduled_for', scheduled_for)
    from inserted
    returning booking_id
  )
  select count(*) into v_queued from logged;

  return jsonb_build_object(
    'queued', v_queued,
    'rescheduled', v_rescheduled,
    'skipped', v_skipped,
    'window_start', v_start,
    'window_end', v_end,
    'processed_at', v_now
  );
end;
$$;

comment on function public.enqueue_booking_reminders(timestamptz, timestamptz) is
  'Queues one reminder per confirmed booking, dispatches at the 24-hour point, follows session moves and permanently closes terminal bookings.';

-- Authoritative database guard for mandatory follow-up selection. It locks all
-- session rows in deterministic order before validation and then delegates to
-- v4 in the same transaction, eliminating the revalidation-to-reservation race.
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

    if not v_primary_workshop.requires_followup_session then
      continue;
    end if;

    select count(*) into v_followup_count
    from jsonb_array_elements(p_lines) candidate
    where candidate->>'type' = 'workshop_session'
      and candidate->>'link_role' = 'followup'
      and candidate->>'linked_primary_session_id' = v_primary_session.id::text;

    if v_followup_count <> 1 then
      raise exception 'Follow-up session is required exactly once';
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
      and primary_workshop.requires_followup_session;

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
  'Authoritatively locks and validates mandatory follow-up sessions before unified atomic checkout.';
