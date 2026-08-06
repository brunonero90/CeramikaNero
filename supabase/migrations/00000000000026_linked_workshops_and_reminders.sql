-- Ceramika Nero — linked workshops, participant audience metadata and reminders.
-- Additive migration applied after voucher migration 25.

-- ---------------------------------------------------------------------------
-- Workshop metadata
-- ---------------------------------------------------------------------------

alter table public.workshops
  add column if not exists participant_audience text not null default 'adult',
  add column if not exists collect_participant_age boolean not null default false,
  add column if not exists workshop_type text,
  add column if not exists requires_followup_session boolean not null default false,
  add column if not exists followup_workshop_id uuid references public.workshops(id) on delete set null,
  add column if not exists followup_workshop_type text,
  add column if not exists followup_min_days integer,
  add column if not exists followup_max_days integer;

alter table public.workshops
  drop constraint if exists workshops_participant_audience_check;
alter table public.workshops
  add constraint workshops_participant_audience_check
  check (participant_audience in ('adult', 'child', 'mixed'));

alter table public.workshops
  drop constraint if exists workshops_followup_days_check;
alter table public.workshops
  add constraint workshops_followup_days_check
  check (
    (followup_min_days is null or followup_min_days >= 0)
    and (followup_max_days is null or followup_max_days >= 0)
    and (
      followup_min_days is null
      or followup_max_days is null
      or followup_min_days <= followup_max_days
    )
  );

alter table public.workshops
  drop constraint if exists workshops_followup_configuration_check;
alter table public.workshops
  add constraint workshops_followup_configuration_check
  check (
    not requires_followup_session
    or followup_workshop_id is not null
    or nullif(trim(followup_workshop_type), '') is not null
  );

update public.workshops
set workshop_type = slug
where workshop_type is null or trim(workshop_type) = '';

-- Preserve the current adult experience while explicitly marking child/mixed
-- workshops. Ages are collected only where the studio asks for child ages.
update public.workshops w
set participant_audience = case
      when c.slug = 'rodzinne' then 'mixed'
      else 'child'
    end,
    collect_participant_age = true
from public.workshop_categories c
where c.id = w.category_id
  and (
    c.slug in ('dla-dzieci', 'rodzinne')
    or (w.maximum_age is not null and w.maximum_age < 18)
    or lower(w.title) like '%dzieci%'
    or lower(w.title) like '%młodzie%'
  );

-- Configure Glina do Wina automatically only when an actual glazing workshop
-- already exists. Otherwise the admin form exposes the required configuration
-- without breaking current checkout.
do $$
declare
  v_primary uuid;
  v_followup uuid;
  v_followup_type text;
begin
  select id into v_primary
  from public.workshops
  where slug in ('glina-do-wina', 'glinadowina')
     or lower(title) = 'glina do wina'
  order by created_at asc
  limit 1;

  select id, workshop_type into v_followup, v_followup_type
  from public.workshops
  where id is distinct from v_primary
    and (
      lower(slug) like '%szkliw%'
      or lower(title) like '%szkliw%'
      or lower(coalesce(workshop_type, '')) like '%szkliw%'
    )
  order by created_at asc
  limit 1;

  if v_primary is not null and v_followup is not null then
    update public.workshops
    set requires_followup_session = true,
        followup_workshop_id = v_followup,
        followup_workshop_type = coalesce(v_followup_type, 'szkliwienie'),
        followup_min_days = coalesce(followup_min_days, 5),
        followup_max_days = coalesce(followup_max_days, 45),
        updated_at = timezone('utc'::text, now())
    where id = v_primary;
  end if;
end
$$;

comment on column public.workshops.participant_audience is
  'adult, child or mixed. Controls participant-name reuse and child-age collection.';
comment on column public.workshops.collect_participant_age is
  'When true, child participants must provide age; adult participants never do.';
comment on column public.workshops.workshop_type is
  'Stable operational type used to resolve reusable linked-workshop flows.';
comment on column public.workshops.requires_followup_session is
  'Requires selecting a second session in the same checkout.';
comment on column public.workshops.followup_workshop_id is
  'Preferred exact workshop used for the mandatory follow-up stage.';
comment on column public.workshops.followup_workshop_type is
  'Fallback type/slug used when no exact follow-up workshop ID is configured.';

create index if not exists idx_workshops_workshop_type
  on public.workshops (workshop_type)
  where archived_at is null;
create index if not exists idx_workshops_followup
  on public.workshops (requires_followup_session, followup_workshop_id)
  where requires_followup_session = true;

-- ---------------------------------------------------------------------------
-- Explicit links between bookings created in one multi-stage checkout
-- ---------------------------------------------------------------------------

create table if not exists public.booking_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  primary_booking_id uuid not null references public.bookings(id) on delete cascade,
  followup_booking_id uuid not null references public.bookings(id) on delete cascade,
  relationship text not null default 'mandatory_followup'
    check (relationship in ('mandatory_followup', 'optional_followup')),
  group_key text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint booking_links_distinct_check check (primary_booking_id <> followup_booking_id),
  constraint booking_links_pair_unique unique (primary_booking_id, followup_booking_id)
);

create index if not exists idx_booking_links_order
  on public.booking_links (order_id, created_at);
create index if not exists idx_booking_links_primary
  on public.booking_links (primary_booking_id);
create index if not exists idx_booking_links_followup
  on public.booking_links (followup_booking_id);

alter table public.booking_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_links'
      and policyname = 'Managers and owners can view booking links'
  ) then
    create policy "Managers and owners can view booking links"
      on public.booking_links for select
      to authenticated
      using (public.is_admin_role('owner') or public.is_admin_role('manager'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'booking_links'
      and policyname = 'Service role can manage booking links'
  ) then
    create policy "Service role can manage booking links"
      on public.booking_links for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Reminder queue and auditability
-- ---------------------------------------------------------------------------

alter table public.booking_emails
  drop constraint if exists booking_emails_email_type_check;
alter table public.booking_emails
  add constraint booking_emails_email_type_check
  check (
    email_type in (
      'confirmation',
      'cancellation',
      'refund',
      'manual_confirmation',
      'payment_problem',
      'admin_notification',
      'reminder'
    )
  );

alter table public.booking_emails
  add column if not exists scheduled_for timestamptz;

create unique index if not exists idx_booking_emails_one_reminder
  on public.booking_emails (booking_id, email_type)
  where email_type = 'reminder';

alter table public.booking_events
  drop constraint if exists booking_events_event_type_check;
alter table public.booking_events
  add constraint booking_events_event_type_check
  check (
    event_type in (
      'reserved', 'confirmed', 'expired', 'cancelled', 'refunded', 'moved',
      'email_sent', 'email_failed', 'payment_failed', 'note',
      'reminder_queued', 'reminder_sent', 'reminder_skipped', 'linked'
    )
  );

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
  v_skipped integer := 0;
begin
  v_start := coalesce(p_window_start, v_now + interval '23 hours');
  v_end := coalesce(p_window_end, v_now + interval '25 hours');

  if v_end <= v_start then
    raise exception 'Reminder window end must be after start';
  end if;

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
      v_now,
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
    'skipped', v_skipped,
    'window_start', v_start,
    'window_end', v_end,
    'processed_at', v_now
  );
end;
$$;

revoke all on function public.enqueue_booking_reminders(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.enqueue_booking_reminders(timestamptz, timestamptz)
  to service_role;

comment on function public.enqueue_booking_reminders(timestamptz, timestamptz) is
  'Queues exactly one reminder for each confirmed booking approximately 24 hours before its session.';

-- ---------------------------------------------------------------------------
-- Linked cancellation: all stages release capacity together exactly once
-- ---------------------------------------------------------------------------

create or replace function public.cancel_single_booking(
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
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then raise exception 'Booking not found'; end if;

  if v_booking.status in ('cancelled', 'expired', 'refunded', 'partially_refunded') then
    return jsonb_build_object('already_cancelled', true, 'status', v_booking.status);
  end if;

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
  where id = v_booking.workshop_session_id;

  insert into public.booking_events (
    booking_id, event_type, actor_type, actor_id, actor_role, metadata
  ) values (
    p_booking_id,
    'cancelled',
    case when p_actor_id is null then 'customer' else 'admin' end,
    p_actor_id,
    p_actor_role,
    jsonb_build_object('reason', p_reason, 'previous_status', v_booking.status)
  );

  return jsonb_build_object('booking_id', p_booking_id, 'status', 'cancelled');
end;
$$;

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
  v_related_id uuid;
  v_count integer := 0;
begin
  if not exists (select 1 from public.bookings where id = p_booking_id) then
    raise exception 'Booking not found';
  end if;

  for v_related_id in
    select id
    from (
      select p_booking_id as id
      union
      select bl.followup_booking_id
      from public.booking_links bl
      where bl.primary_booking_id = p_booking_id
      union
      select bl.primary_booking_id
      from public.booking_links bl
      where bl.followup_booking_id = p_booking_id
    ) related
    order by id
  loop
    perform public.cancel_single_booking(
      v_related_id, p_cancelled_by, p_reason, p_actor_id, p_actor_role
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'cancelled',
    'linked_bookings_processed', v_count
  );
end;
$$;

revoke all on function public.cancel_single_booking(uuid, text, text, uuid, text)
  from public, anon;
grant execute on function public.cancel_single_booking(uuid, text, text, uuid, text)
  to authenticated, service_role;

comment on function public.cancel_booking(uuid, text, text, uuid, text) is
  'Cancels a booking and every explicitly linked stage, releasing each session capacity exactly once.';

-- ---------------------------------------------------------------------------
-- Unified checkout v4: audience-aware ages and atomic booking links
-- ---------------------------------------------------------------------------

create or replace function public.submit_cart_order_v4(
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
  v_line jsonb;
  v_participant jsonb;
  v_participants jsonb;
  v_normalized_lines jsonb := '[]'::jsonb;
  v_session public.workshop_sessions;
  v_workshop public.workshops;
  v_type text;
  v_age integer;
  v_result jsonb;
  v_order_id uuid;
  v_primary_booking_id uuid;
  v_followup_booking_id uuid;
  v_primary_session_id uuid;
  v_followup_session_id uuid;
  v_group_key text;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be an array';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if v_line->>'type' <> 'workshop_session' then
      v_normalized_lines := v_normalized_lines || jsonb_build_array(v_line);
      continue;
    end if;

    select s.* into v_session
    from public.workshop_sessions s
    where s.id = (v_line->>'session_id')::uuid;
    if not found then raise exception 'Session not found'; end if;

    select w.* into v_workshop
    from public.workshops w
    where w.id = v_session.workshop_id;
    if not found then raise exception 'Workshop not found'; end if;

    v_participants := '[]'::jsonb;
    for v_participant in
      select value from jsonb_array_elements(coalesce(v_line->'participants', '[]'::jsonb))
    loop
      v_type := nullif(v_participant->>'participant_type', '');
      if v_workshop.participant_audience = 'adult' then
        v_type := 'adult';
      elsif v_workshop.participant_audience = 'child' then
        v_type := 'child';
      elsif v_type is null or v_type = 'unspecified' then
        v_type := case
          when nullif(v_participant->>'age', '') is not null then 'child'
          else 'adult'
        end;
      end if;

      v_age := null;
      if nullif(v_participant->>'age', '') is not null then
        v_age := (v_participant->>'age')::integer;
      end if;

      if v_type = 'child' and v_workshop.collect_participant_age and v_age is null then
        raise exception 'Participant age is required for child participants';
      end if;

      if v_type = 'child' and v_age is not null then
        if v_age < coalesce(v_workshop.minimum_age, 0)
           or v_age > coalesce(v_workshop.maximum_age, 999) then
          raise exception 'Participant age is outside workshop limits';
        end if;
      end if;

      -- Legacy submit_cart_order validates age for every participant whenever
      -- min/max exists. Supply a temporary valid adult age and remove it from
      -- persisted participant rows immediately after the atomic order write.
      if v_type = 'adult' and v_age is null
         and (v_workshop.minimum_age is not null or v_workshop.maximum_age is not null) then
        v_age := greatest(18, coalesce(v_workshop.minimum_age, 18));
        if v_workshop.maximum_age is not null then
          v_age := least(v_age, v_workshop.maximum_age);
        end if;
      end if;

      v_participant := jsonb_set(
        v_participant,
        '{participant_type}',
        to_jsonb(v_type),
        true
      );
      v_participant := jsonb_set(
        v_participant,
        '{age}',
        case when v_age is null then 'null'::jsonb else to_jsonb(v_age) end,
        true
      );
      v_participants := v_participants || jsonb_build_array(v_participant);
    end loop;

    v_line := jsonb_set(v_line, '{participants}', v_participants, true);
    v_normalized_lines := v_normalized_lines || jsonb_build_array(v_line);
  end loop;

  v_result := public.submit_cart_order_v3(
    p_idempotency_key,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_customer_notes,
    p_marketing_consent,
    p_terms_accepted_at,
    p_privacy_policy_version,
    v_normalized_lines,
    p_shipping_address,
    p_source,
    p_selected_payment_method,
    p_voucher_code
  );

  v_order_id := (v_result->>'order_id')::uuid;

  update public.booking_participants bp
  set age = null,
      participant_type = 'adult'
  from public.bookings b
  where b.order_id = v_order_id
    and bp.booking_id = b.id
    and bp.participant_type = 'adult';

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if v_line->>'type' <> 'workshop_session'
       or v_line->>'link_role' <> 'followup' then
      continue;
    end if;

    v_followup_session_id := (v_line->>'session_id')::uuid;
    v_primary_session_id := nullif(v_line->>'linked_primary_session_id', '')::uuid;
    v_group_key := coalesce(
      nullif(v_line->>'link_group_key', ''),
      v_primary_session_id::text || ':' || v_followup_session_id::text
    );

    if v_primary_session_id is null then
      raise exception 'Follow-up session is missing its primary session link';
    end if;

    select id into v_primary_booking_id
    from public.bookings
    where order_id = v_order_id
      and workshop_session_id = v_primary_session_id
    order by created_at asc
    limit 1;

    select id into v_followup_booking_id
    from public.bookings
    where order_id = v_order_id
      and workshop_session_id = v_followup_session_id
    order by created_at asc
    limit 1;

    if v_primary_booking_id is null or v_followup_booking_id is null then
      raise exception 'Unable to resolve linked bookings after checkout';
    end if;

    insert into public.booking_links (
      order_id, primary_booking_id, followup_booking_id,
      relationship, group_key
    ) values (
      v_order_id, v_primary_booking_id, v_followup_booking_id,
      'mandatory_followup', v_group_key
    )
    on conflict (primary_booking_id, followup_booking_id) do nothing;

    insert into public.booking_events (
      booking_id, event_type, actor_type, metadata
    ) values
      (
        v_primary_booking_id, 'linked', 'system',
        jsonb_build_object(
          'relationship', 'mandatory_followup',
          'linked_booking_id', v_followup_booking_id,
          'group_key', v_group_key
        )
      ),
      (
        v_followup_booking_id, 'linked', 'system',
        jsonb_build_object(
          'relationship', 'followup_of',
          'linked_booking_id', v_primary_booking_id,
          'group_key', v_group_key
        )
      )
    on conflict do nothing;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.submit_cart_order_v4(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v4(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) to service_role;

comment on function public.submit_cart_order_v4(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) is
  'Unified checkout with adult-name reuse, child-only age collection and atomic linked booking records.';


-- Admin helper for metadata not present in the original workshop upsert RPC.
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
      followup_workshop_type = nullif(trim(coalesce(p_followup_workshop_type, '')), ''),
      followup_min_days = p_followup_min_days,
      followup_max_days = p_followup_max_days,
      updated_at = timezone('utc'::text, now())
  where id = p_workshop_id;
  if not found then raise exception 'Workshop not found'; end if;
end;
$$;

revoke all on function public.set_workshop_operational_metadata(
  uuid, text, boolean, text, boolean, text, integer, integer
) from public, anon;
grant execute on function public.set_workshop_operational_metadata(
  uuid, text, boolean, text, boolean, text, integer, integer
) to authenticated, service_role;

create or replace function public.get_linked_booking_summary(p_booking_id uuid)
returns jsonb
language sql
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(result order by result.starts_at), '[]'::jsonb)
  from (
    select
      b.id,
      b.booking_reference as reference,
      case
        when bl.primary_booking_id = p_booking_id then 'drugi etap'
        else 'pierwszy etap'
      end as relationship,
      w.title as workshop_title,
      s.starts_at,
      b.status
    from public.booking_links bl
    join public.bookings b
      on b.id = case
        when bl.primary_booking_id = p_booking_id then bl.followup_booking_id
        else bl.primary_booking_id
      end
    join public.workshop_sessions s on s.id = b.workshop_session_id
    join public.workshops w on w.id = s.workshop_id
    where bl.primary_booking_id = p_booking_id
       or bl.followup_booking_id = p_booking_id
  ) result;
$$;

revoke all on function public.get_linked_booking_summary(uuid) from public, anon;
grant execute on function public.get_linked_booking_summary(uuid)
  to authenticated, service_role;
