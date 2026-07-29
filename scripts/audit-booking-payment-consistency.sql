-- Ceramika Nero — read-only booking/payment consistency audit.
-- Safe for production: SELECT only. No PII columns (names, emails, phones, addresses, notes).
-- Run in Supabase SQL editor or psql against a disposable/staging DB after migrations 00–19.

-- ---------------------------------------------------------------------------
-- 1) Paid Stripe payments with unpaid orders
-- ---------------------------------------------------------------------------
select
  'paid_stripe_payment_unpaid_order' as check_id,
  count(*)::int as finding_count
from public.payments p
join public.orders o on o.id = p.order_id
where p.provider = 'stripe'
  and p.status = 'paid'
  and o.payment_status not in ('paid', 'refunded', 'partially_refunded');

select
  'paid_stripe_payment_unpaid_order_refs' as check_id,
  o.order_reference,
  p.id as payment_id,
  p.status as payment_status,
  o.payment_status as order_payment_status,
  o.status as order_status
from public.payments p
join public.orders o on o.id = p.order_id
where p.provider = 'stripe'
  and p.status = 'paid'
  and o.payment_status not in ('paid', 'refunded', 'partially_refunded')
limit 50;

-- ---------------------------------------------------------------------------
-- 2) Paid orders with unconfirmed active bookings
-- ---------------------------------------------------------------------------
select
  'paid_order_unconfirmed_booking' as check_id,
  count(*)::int as finding_count
from public.orders o
join public.bookings b on b.order_id = o.id
where o.payment_status = 'paid'
  and b.status in ('pending', 'awaiting_payment');

select
  'paid_order_unconfirmed_booking_refs' as check_id,
  o.order_reference,
  b.booking_reference,
  b.status as booking_status,
  o.payment_status
from public.orders o
join public.bookings b on b.order_id = o.id
where o.payment_status = 'paid'
  and b.status in ('pending', 'awaiting_payment')
limit 50;

-- ---------------------------------------------------------------------------
-- 3) Confirmed bookings without appropriate payment state
-- ---------------------------------------------------------------------------
select
  'confirmed_booking_without_paid_payment' as check_id,
  count(*)::int as finding_count
from public.bookings b
left join lateral (
  select p.status
  from public.payments p
  where (p.booking_id = b.id or (b.order_id is not null and p.order_id = b.order_id))
  order by case when p.status in ('paid') then 0 else 1 end, p.created_at desc
  limit 1
) pay on true
where b.status = 'confirmed'
  and coalesce(pay.status, 'missing') not in ('paid', 'partially_refunded', 'refunded');

select
  'confirmed_booking_without_paid_payment_refs' as check_id,
  b.booking_reference,
  b.status as booking_status,
  coalesce(pay.status, 'missing') as best_payment_status
from public.bookings b
left join lateral (
  select p.status
  from public.payments p
  where (p.booking_id = b.id or (b.order_id is not null and p.order_id = b.order_id))
  order by case when p.status in ('paid') then 0 else 1 end, p.created_at desc
  limit 1
) pay on true
where b.status = 'confirmed'
  and coalesce(pay.status, 'missing') not in ('paid', 'partially_refunded', 'refunded')
limit 50;

-- ---------------------------------------------------------------------------
-- 4) Multiple successful payments for one order
-- ---------------------------------------------------------------------------
select
  'multiple_successful_payments_per_order' as check_id,
  count(*)::int as finding_count
from (
  select order_id
  from public.payments
  where order_id is not null
    and status = 'paid'
  group by order_id
  having count(*) > 1
) t;

select
  'multiple_successful_payments_per_order_refs' as check_id,
  o.order_reference,
  count(*)::int as successful_payment_count
from public.payments p
join public.orders o on o.id = p.order_id
where p.status = 'paid'
group by o.order_reference
having count(*) > 1
limit 50;

-- ---------------------------------------------------------------------------
-- 5) Over-capacity sessions
-- ---------------------------------------------------------------------------
select
  'over_capacity_sessions' as check_id,
  count(*)::int as finding_count
from public.workshop_sessions
where reserved_count > capacity;

select
  'over_capacity_sessions_refs' as check_id,
  id as session_id,
  capacity,
  reserved_count,
  (reserved_count - capacity) as oversell_units
from public.workshop_sessions
where reserved_count > capacity
limit 50;

-- ---------------------------------------------------------------------------
-- 6) Negative remaining inventory (tracked products)
-- ---------------------------------------------------------------------------
select
  'negative_inventory' as check_id,
  count(*)::int as finding_count
from public.products
where track_inventory is true
  and inventory_quantity < 0;

select
  'negative_inventory_refs' as check_id,
  id as product_id,
  sku,
  inventory_quantity
from public.products
where track_inventory is true
  and inventory_quantity < 0
limit 50;

-- ---------------------------------------------------------------------------
-- 7) Terminal orders still presenting a payable attempt
-- ---------------------------------------------------------------------------
select
  'terminal_order_open_payment' as check_id,
  count(*)::int as finding_count
from public.orders o
join public.payments p on p.order_id = o.id
where o.status in ('cancelled', 'expired', 'refunded')
  and p.status in ('created', 'pending');

select
  'terminal_order_open_payment_refs' as check_id,
  o.order_reference,
  o.status as order_status,
  p.id as payment_id,
  p.status as payment_status
from public.orders o
join public.payments p on p.order_id = o.id
where o.status in ('cancelled', 'expired', 'refunded')
  and p.status in ('created', 'pending')
limit 50;

-- ---------------------------------------------------------------------------
-- 8) Failed Stripe events eligible for retry
-- ---------------------------------------------------------------------------
select
  'stripe_events_retryable' as check_id,
  count(*)::int as finding_count
from public.stripe_events
where processing_status = 'failed';

select
  'stripe_events_retryable_refs' as check_id,
  event_id,
  event_type,
  processing_status,
  attempt_count,
  last_error is not null as has_error,
  processed_at
from public.stripe_events
where processing_status = 'failed'
order by processed_at desc nulls last
limit 50;

-- ---------------------------------------------------------------------------
-- 9) Processed events with recorded errors
-- ---------------------------------------------------------------------------
select
  'processed_events_with_errors' as check_id,
  count(*)::int as finding_count
from public.stripe_events
where processing_status = 'processed'
  and last_error is not null;

select
  'processed_events_with_errors_refs' as check_id,
  event_id,
  event_type,
  processing_status
from public.stripe_events
where processing_status = 'processed'
  and last_error is not null
limit 50;

-- ---------------------------------------------------------------------------
-- 10) Duplicate success-email rows (order_id + email_type)
-- ---------------------------------------------------------------------------
select
  'duplicate_order_payment_received_emails' as check_id,
  count(*)::int as finding_count
from (
  select order_id
  from public.order_emails
  where email_type = 'payment_received'
  group by order_id
  having count(*) > 1
) t;

select
  'duplicate_booking_confirmation_emails' as check_id,
  count(*)::int as finding_count
from (
  select booking_id
  from public.booking_emails
  where email_type = 'confirmation'
  group by booking_id
  having count(*) > 1
) t;

select
  'duplicate_order_payment_received_refs' as check_id,
  o.order_reference,
  count(*)::int as email_rows
from public.order_emails e
join public.orders o on o.id = e.order_id
where e.email_type = 'payment_received'
group by o.order_reference
having count(*) > 1
limit 50;

-- ---------------------------------------------------------------------------
-- 11) Stripe rows with livemode is null
-- ---------------------------------------------------------------------------
select
  'stripe_payments_livemode_null' as check_id,
  count(*)::int as finding_count
from public.payments
where provider = 'stripe'
  and livemode is null;

select
  'stripe_payments_livemode_null_refs' as check_id,
  id as payment_id,
  status,
  order_id is not null as has_order,
  booking_id is not null as has_booking
from public.payments
where provider = 'stripe'
  and livemode is null
limit 50;

-- ---------------------------------------------------------------------------
-- 12) Order/booking analytics-exclusion mismatches
-- ---------------------------------------------------------------------------
select
  'analytics_exclusion_mismatch' as check_id,
  count(*)::int as finding_count
from public.orders o
join public.bookings b on b.order_id = o.id
where o.analytics_excluded is distinct from b.analytics_excluded;

select
  'analytics_exclusion_mismatch_refs' as check_id,
  o.order_reference,
  b.booking_reference,
  o.analytics_excluded as order_excluded,
  b.analytics_excluded as booking_excluded
from public.orders o
join public.bookings b on b.order_id = o.id
where o.analytics_excluded is distinct from b.analytics_excluded
limit 50;

-- ---------------------------------------------------------------------------
-- 13) Session reserved_count vs active booking holds
-- ---------------------------------------------------------------------------
select
  'session_reserved_vs_active_holds' as check_id,
  ws.id as session_id,
  ws.capacity,
  ws.reserved_count,
  coalesce(sum(b.quantity) filter (
    where b.status in ('pending', 'awaiting_payment', 'confirmed')
  ), 0)::int as active_hold_units,
  (ws.reserved_count - coalesce(sum(b.quantity) filter (
    where b.status in ('pending', 'awaiting_payment', 'confirmed')
  ), 0))::int as reserved_minus_active
from public.workshop_sessions ws
left join public.bookings b on b.workshop_session_id = ws.id
group by ws.id, ws.capacity, ws.reserved_count
having ws.reserved_count <> coalesce(sum(b.quantity) filter (
  where b.status in ('pending', 'awaiting_payment', 'confirmed')
), 0)
order by abs(ws.reserved_count - coalesce(sum(b.quantity) filter (
  where b.status in ('pending', 'awaiting_payment', 'confirmed')
), 0)) desc
limit 50;
