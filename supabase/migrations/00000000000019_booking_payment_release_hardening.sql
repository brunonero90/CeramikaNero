-- Ceramika Nero — Booking/payment release hardening (audit fixes).
-- Additive. Does not rewrite migrations 00–18.
-- Apply AFTER migration 18.
--
-- Fixes:
-- 1) expire awaiting_payment holds (cart Stripe) not only legacy pending
-- 2) expire unpaid orders past expires_at
-- 3) cancel_order_and_release — capacity + inventory on admin/order cancel
-- 4) set_updated_at search_path for SECURITY DEFINER hygiene

-- ---------------------------------------------------------------------------
-- set_updated_at: fixed search_path
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- expire_pending_bookings: include awaiting_payment cart holds
-- ---------------------------------------------------------------------------

create or replace function public.expire_pending_bookings()
returns table(booking_id uuid, booking_reference text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz;
  v_booking record;
  v_order record;
  v_item record;
begin
  v_now := timezone('utc'::text, now());

  for v_booking in
    select b.id, b.booking_reference, b.quantity, b.workshop_session_id, b.order_id
    from public.bookings b
    where b.status in ('pending', 'awaiting_payment')
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

    -- Fail unpaid Stripe/manual attempts tied to this booking or its order.
    update public.payments
    set status = 'failed',
        failure_message = coalesce(failure_message, 'Booking hold expired'),
        updated_at = v_now
    where status in ('created', 'pending')
      and (
        booking_id = v_booking.id
        or (v_booking.order_id is not null and order_id = v_booking.order_id)
      );

    booking_id := v_booking.id;
    booking_reference := v_booking.booking_reference;
    return next;
  end loop;

  -- Expire unpaid orders whose hold elapsed (Stripe Checkout window).
  -- Restore tracked product inventory once; workshop capacity already released
  -- above when linked bookings expire.
  for v_order in
    select o.id as order_id
    from public.orders o
    where o.status = 'awaiting_payment'
      and o.expires_at is not null
      and o.expires_at < v_now
      and o.payment_status in ('pending', 'failed')
    for update
  loop
    for v_item in
      select oi.product_id, oi.quantity, p.track_inventory
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.order_id = v_order.order_id
        and oi.product_id is not null
        and oi.item_type in ('physical_product', 'studio_service')
    loop
      if v_item.track_inventory then
        update public.products
        set inventory_quantity = inventory_quantity + v_item.quantity,
            updated_at = v_now
        where id = v_item.product_id;
      end if;
    end loop;

    update public.orders
    set status = 'expired',
        payment_status = case
          when payment_status = 'pending' then 'failed'
          else payment_status
        end,
        updated_at = v_now
    where id = v_order.order_id;

    update public.payments
    set status = 'failed',
        failure_message = coalesce(failure_message, 'Order hold expired'),
        updated_at = v_now
    where order_id = v_order.order_id
      and status in ('created', 'pending');
  end loop;
end;
$$;

comment on function public.expire_pending_bookings() is
  'Expires pending/awaiting_payment bookings past expires_at and releases capacity once. Also expires unpaid orders past expires_at.';

-- ---------------------------------------------------------------------------
-- cancel_order_and_release — authoritative order cancel with capacity/inventory
-- ---------------------------------------------------------------------------

create or replace function public.cancel_order_and_release(
  p_order_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_role text default 'manager'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_booking record;
  v_item record;
  v_now timestamptz := timezone('utc'::text, now());
  v_cancelled_bookings int := 0;
  v_restored_inventory int := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status in ('cancelled', 'expired', 'refunded') then
    return jsonb_build_object(
      'status', 'already_terminal',
      'order_status', v_order.status
    );
  end if;

  -- Cancel linked bookings and release capacity exactly once via cancel_booking.
  for v_booking in
    select id, status from public.bookings where order_id = p_order_id for update
  loop
    if v_booking.status in ('pending', 'awaiting_payment', 'confirmed') then
      perform public.cancel_booking(
        v_booking.id,
        'staff',
        coalesce(nullif(p_reason, ''), 'Order cancelled'),
        p_actor_user_id,
        p_actor_role
      );
      v_cancelled_bookings := v_cancelled_bookings + 1;
    end if;
  end loop;

  -- Restore tracked product inventory for product lines (once per cancel).
  for v_item in
    select oi.product_id, oi.quantity, p.track_inventory
    from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = p_order_id
      and oi.product_id is not null
      and oi.item_type in ('physical_product', 'studio_service')
  loop
    if v_item.track_inventory then
      update public.products
      set inventory_quantity = inventory_quantity + v_item.quantity,
          updated_at = v_now
      where id = v_item.product_id;
      v_restored_inventory := v_restored_inventory + v_item.quantity;
    end if;
  end loop;

  update public.orders
  set status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, v_now),
      payment_status = case
        when payment_status = 'pending' then 'cancelled'
        else payment_status
      end,
      fulfillment_status = case
        when fulfillment_status = 'unfulfilled' then 'cancelled'
        else fulfillment_status
      end,
      updated_at = v_now
  where id = p_order_id;

  update public.payments
  set status = 'cancelled',
      failure_message = coalesce(failure_message, 'Order cancelled'),
      updated_at = v_now
  where order_id = p_order_id
    and status in ('created', 'pending');

  insert into public.order_events (order_id, event_type, actor_type, actor_id, metadata)
  values (
    p_order_id,
    'cancelled',
    'admin',
    p_actor_user_id,
    jsonb_build_object(
      'reason', coalesce(nullif(p_reason, ''), 'Order cancelled'),
      'cancelled_bookings', v_cancelled_bookings,
      'restored_inventory_units', v_restored_inventory
    )
  );

  return jsonb_build_object(
    'status', 'cancelled',
    'cancelled_bookings', v_cancelled_bookings,
    'restored_inventory_units', v_restored_inventory
  );
end;
$$;

revoke all on function public.cancel_order_and_release(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_order_and_release(uuid, text, uuid, text)
  to service_role;

comment on function public.cancel_order_and_release(uuid, text, uuid, text) is
  'Cancels an order, cancels linked active bookings (releasing capacity once), and restores tracked product inventory.';
