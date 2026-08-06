-- Ceramika Nero — hardening for reusable multi-stage booking chains.
-- Apply after migration 26.

-- submit_cart_order_v4 uses ON CONFLICT DO NOTHING for link events. This
-- expression index makes checkout replay idempotent at the audit-log level too.
create unique index if not exists idx_booking_events_link_once
  on public.booking_events (
    booking_id,
    event_type,
    (metadata ->> 'group_key'),
    (metadata ->> 'relationship')
  )
  where event_type = 'linked';

-- Follow every booking_links edge, not only one direct pair. This supports
-- future three-stage and longer workshop chains without another cancellation
-- implementation.
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
    with recursive connected(id) as (
      select p_booking_id
      union
      select case
        when bl.primary_booking_id = connected.id then bl.followup_booking_id
        else bl.primary_booking_id
      end
      from connected
      join public.booking_links bl
        on bl.primary_booking_id = connected.id
        or bl.followup_booking_id = connected.id
    )
    select distinct id
    from connected
    order by id
  loop
    perform public.cancel_single_booking(
      v_related_id,
      p_cancelled_by,
      p_reason,
      p_actor_id,
      p_actor_role
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

comment on function public.cancel_booking(uuid, text, text, uuid, text) is
  'Cancels the complete connected multi-stage booking chain and releases each session capacity exactly once.';
