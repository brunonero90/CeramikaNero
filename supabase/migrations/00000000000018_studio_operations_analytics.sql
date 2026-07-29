-- Ceramika Nero — Studio Operations & Analytics v1
-- Additive. Does not rewrite migrations 00–17.
-- Apply AFTER migration 17.
-- Rollback notes: drop new RPCs/views/indexes/columns on
--   booking_participants, payments, orders, bookings, workshop_sessions.

-- ---------------------------------------------------------------------------
-- Expand booking_events for attendance (safe operational metadata only)
-- ---------------------------------------------------------------------------

alter table public.booking_events
  drop constraint if exists booking_events_event_type_check;

alter table public.booking_events
  add constraint booking_events_event_type_check
  check (event_type in (
    'reserved', 'confirmed', 'expired', 'cancelled', 'refunded', 'moved',
    'email_sent', 'email_failed', 'payment_failed', 'note', 'attendance_updated'
  ));

-- ---------------------------------------------------------------------------
-- Attendance on booking_participants
-- ---------------------------------------------------------------------------

alter table public.booking_participants
  add column if not exists attendance_status text;

alter table public.booking_participants
  add column if not exists checked_in_at timestamptz;

alter table public.booking_participants
  add column if not exists attendance_updated_at timestamptz;

alter table public.booking_participants
  add column if not exists attendance_updated_by uuid references auth.users (id) on delete set null;

alter table public.booking_participants
  add column if not exists attendance_note text;

update public.booking_participants
set attendance_status = 'expected'
where attendance_status is null;

alter table public.booking_participants
  alter column attendance_status set default 'expected';

alter table public.booking_participants
  alter column attendance_status set not null;

alter table public.booking_participants
  drop constraint if exists booking_participants_attendance_status_check;

alter table public.booking_participants
  add constraint booking_participants_attendance_status_check
  check (attendance_status in ('expected', 'checked_in', 'no_show', 'excused'));

comment on column public.booking_participants.attendance_status is
  'Day-of attendance. Independent of payment/capacity/booking status.';

-- ---------------------------------------------------------------------------
-- Session attendance review marker
-- ---------------------------------------------------------------------------

alter table public.workshop_sessions
  add column if not exists attendance_reviewed_at timestamptz;

alter table public.workshop_sessions
  add column if not exists attendance_reviewed_by uuid references auth.users (id) on delete set null;

comment on column public.workshop_sessions.attendance_reviewed_at is
  'Set when studio marks attendance review complete for the session.';

-- ---------------------------------------------------------------------------
-- Analytics quality: Stripe livemode + exclusion flags
-- ---------------------------------------------------------------------------

alter table public.payments
  add column if not exists livemode boolean;

comment on column public.payments.livemode is
  'Authoritative Stripe livemode when known. NULL = unclassified (excluded from default analytics).';

alter table public.orders
  add column if not exists analytics_excluded boolean not null default false;

alter table public.orders
  add column if not exists analytics_excluded_reason text;

alter table public.orders
  add column if not exists analytics_excluded_at timestamptz;

alter table public.orders
  add column if not exists analytics_excluded_by uuid references auth.users (id) on delete set null;

alter table public.bookings
  add column if not exists analytics_excluded boolean not null default false;

alter table public.bookings
  add column if not exists analytics_excluded_reason text;

alter table public.bookings
  add column if not exists analytics_excluded_at timestamptz;

alter table public.bookings
  add column if not exists analytics_excluded_by uuid references auth.users (id) on delete set null;

comment on column public.orders.analytics_excluded is
  'When true, order (and linked bookings) are omitted from default analytics.';
comment on column public.bookings.analytics_excluded is
  'When true, booking is omitted from default analytics. Keep in sync with linked order.';

-- ---------------------------------------------------------------------------
-- Indexes for day-of and analytics query paths
-- ---------------------------------------------------------------------------

create index if not exists idx_workshop_sessions_starts_at
  on public.workshop_sessions (starts_at);

create index if not exists idx_bookings_session_status
  on public.bookings (workshop_session_id, status);

create index if not exists idx_bookings_analytics_excluded
  on public.bookings (analytics_excluded)
  where analytics_excluded = false;

create index if not exists idx_orders_analytics_excluded
  on public.orders (analytics_excluded)
  where analytics_excluded = false;

create index if not exists idx_payments_paid_at
  on public.payments (paid_at)
  where status in ('paid', 'partially_refunded', 'refunded');

create index if not exists idx_payments_livemode
  on public.payments (livemode);

create index if not exists idx_booking_participants_attendance
  on public.booking_participants (attendance_status);

-- ---------------------------------------------------------------------------
-- set_participant_attendance — never touches payment/capacity/booking status
-- ---------------------------------------------------------------------------

create or replace function public.set_participant_attendance(
  p_participant_id uuid,
  p_status text,
  p_actor_user_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.booking_participants;
  v_booking public.bookings;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_status not in ('expected', 'checked_in', 'no_show', 'excused') then
    raise exception 'Invalid attendance status';
  end if;

  select * into v_row from public.booking_participants
  where id = p_participant_id for update;
  if not found then
    raise exception 'Participant not found';
  end if;

  select * into v_booking from public.bookings where id = v_row.booking_id;
  if not found then
    raise exception 'Booking not found';
  end if;

  if v_row.attendance_status = p_status
     and coalesce(v_row.attendance_note, '') = coalesce(p_note, v_row.attendance_note, '') then
    return jsonb_build_object(
      'status', 'unchanged',
      'attendance_status', v_row.attendance_status
    );
  end if;

  update public.booking_participants
  set attendance_status = p_status,
      checked_in_at = case
        when p_status = 'checked_in' then coalesce(checked_in_at, v_now)
        else null
      end,
      attendance_updated_at = v_now,
      attendance_updated_by = p_actor_user_id,
      attendance_note = coalesce(p_note, attendance_note),
      updated_at = v_now
  where id = p_participant_id;

  insert into public.booking_events (booking_id, event_type, actor_type, actor_id, metadata)
  values (
    v_row.booking_id,
    'attendance_updated',
    'admin',
    p_actor_user_id,
    jsonb_build_object(
      'participant_id', p_participant_id,
      'from', v_row.attendance_status,
      'to', p_status
    )
  );

  return jsonb_build_object(
    'status', 'updated',
    'attendance_status', p_status
  );
end;
$$;

revoke all on function public.set_participant_attendance(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.set_participant_attendance(uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- mark_remaining_no_shows — only after session start
-- ---------------------------------------------------------------------------

create or replace function public.mark_remaining_no_shows(
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.workshop_sessions;
  v_now timestamptz := timezone('utc'::text, now());
  v_count int := 0;
  v_participant record;
begin
  select * into v_session from public.workshop_sessions
  where id = p_session_id for update;
  if not found then
    raise exception 'Session not found';
  end if;

  if v_session.starts_at > v_now then
    raise exception 'Session has not started yet';
  end if;

  for v_participant in
    select bp.id, bp.booking_id, bp.attendance_status
    from public.booking_participants bp
    join public.bookings b on b.id = bp.booking_id
    where b.workshop_session_id = p_session_id
      and b.status in ('confirmed', 'awaiting_payment', 'pending')
      and bp.attendance_status = 'expected'
    for update of bp
  loop
    update public.booking_participants
    set attendance_status = 'no_show',
        checked_in_at = null,
        attendance_updated_at = v_now,
        attendance_updated_by = p_actor_user_id,
        updated_at = v_now
    where id = v_participant.id;

    insert into public.booking_events (booking_id, event_type, actor_type, actor_id, metadata)
    values (
      v_participant.booking_id,
      'attendance_updated',
      'admin',
      p_actor_user_id,
      jsonb_build_object(
        'participant_id', v_participant.id,
        'from', 'expected',
        'to', 'no_show',
        'bulk', true
      )
    );
    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('status', 'updated', 'marked', v_count);
end;
$$;

revoke all on function public.mark_remaining_no_shows(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_remaining_no_shows(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- complete_session_attendance_review
-- ---------------------------------------------------------------------------

create or replace function public.complete_session_attendance_review(
  p_session_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  update public.workshop_sessions
  set attendance_reviewed_at = coalesce(attendance_reviewed_at, v_now),
      attendance_reviewed_by = coalesce(attendance_reviewed_by, p_actor_user_id),
      updated_at = v_now
  where id = p_session_id;

  if not found then
    raise exception 'Session not found';
  end if;

  return jsonb_build_object('status', 'reviewed');
end;
$$;

revoke all on function public.complete_session_attendance_review(uuid, uuid) from public, anon, authenticated;
grant execute on function public.complete_session_attendance_review(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- set_analytics_excluded — keep linked order/bookings aligned
-- ---------------------------------------------------------------------------

create or replace function public.set_analytics_excluded(
  p_entity_type text,
  p_entity_id uuid,
  p_excluded boolean,
  p_reason text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_order_id uuid;
  v_booking_id uuid;
begin
  if p_entity_type = 'order' then
    v_order_id := p_entity_id;
    update public.orders
    set analytics_excluded = p_excluded,
        analytics_excluded_reason = case when p_excluded then p_reason else null end,
        analytics_excluded_at = case when p_excluded then v_now else null end,
        analytics_excluded_by = case when p_excluded then p_actor_user_id else null end,
        updated_at = v_now
    where id = v_order_id;
    if not found then
      raise exception 'Order not found';
    end if;

    update public.bookings
    set analytics_excluded = p_excluded,
        analytics_excluded_reason = case when p_excluded then p_reason else null end,
        analytics_excluded_at = case when p_excluded then v_now else null end,
        analytics_excluded_by = case when p_excluded then p_actor_user_id else null end,
        updated_at = v_now
    where order_id = v_order_id;

  elsif p_entity_type = 'booking' then
    v_booking_id := p_entity_id;
    update public.bookings
    set analytics_excluded = p_excluded,
        analytics_excluded_reason = case when p_excluded then p_reason else null end,
        analytics_excluded_at = case when p_excluded then v_now else null end,
        analytics_excluded_by = case when p_excluded then p_actor_user_id else null end,
        updated_at = v_now
    where id = v_booking_id
    returning order_id into v_order_id;
    if not found then
      raise exception 'Booking not found';
    end if;

    if v_order_id is not null then
      -- Align sibling bookings + parent order when any linked booking is toggled
      update public.orders
      set analytics_excluded = p_excluded,
          analytics_excluded_reason = case when p_excluded then p_reason else null end,
          analytics_excluded_at = case when p_excluded then v_now else null end,
          analytics_excluded_by = case when p_excluded then p_actor_user_id else null end,
          updated_at = v_now
      where id = v_order_id;

      update public.bookings
      set analytics_excluded = p_excluded,
          analytics_excluded_reason = case when p_excluded then p_reason else null end,
          analytics_excluded_at = case when p_excluded then v_now else null end,
          analytics_excluded_by = case when p_excluded then p_actor_user_id else null end,
          updated_at = v_now
      where order_id = v_order_id;
    end if;
  else
    raise exception 'Unsupported entity type';
  end if;

  return jsonb_build_object(
    'status', 'updated',
    'excluded', p_excluded,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id
  );
end;
$$;

revoke all on function public.set_analytics_excluded(text, uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.set_analytics_excluded(text, uuid, boolean, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Analytics helper view (aggregates only — no PII columns)
-- ---------------------------------------------------------------------------

create or replace view public.analytics_payment_facts
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
  p.paid_at,
  p.livemode,
  p.created_at,
  coalesce(o.analytics_excluded, b.analytics_excluded, false) as analytics_excluded,
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
  select bb.id from public.bookings bb where bb.order_id = p.order_id limit 1
))
left join public.workshop_sessions ws on ws.id = b.workshop_session_id;

comment on view public.analytics_payment_facts is
  'Non-PII payment/booking/session facts for analytics RPCs. Exclude test via livemode and analytics_excluded in queries.';

revoke all on public.analytics_payment_facts from public, anon, authenticated;
grant select on public.analytics_payment_facts to service_role;
