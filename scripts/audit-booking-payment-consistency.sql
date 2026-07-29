-- Ceramika Nero booking/payment consistency audit.
-- READ ONLY: returns counts and internal/public references, never customer PII.
-- Run after migrations 00–19. Every result set should normally be empty,
-- except the explicitly diagnostic livemode/retry sets.

begin transaction read only;

-- 1. Paid Stripe payment attached to an order that is not locally paid.
select
  'paid_stripe_payment_unpaid_order' as diagnostic,
  o.order_reference,
  p.id as payment_id,
  o.status as order_status,
  o.payment_status
from public.payments p
join public.orders o on o.id = p.order_id
where p.provider = 'stripe'
  and p.status = 'paid'
  and o.payment_status <> 'paid'
order by o.created_at desc;

-- 2. Paid order with linked workshop bookings that were not confirmed.
select
  'paid_order_unconfirmed_booking' as diagnostic,
  o.order_reference,
  b.booking_reference,
  b.status as booking_status
from public.orders o
join public.bookings b on b.order_id = o.id
where o.payment_status = 'paid'
  and b.status in ('pending', 'awaiting_payment', 'expired')
order by o.created_at desc, b.booking_reference;

-- 3. Confirmed booking without an appropriate paid/complimentary state.
select
  'confirmed_booking_without_paid_state' as diagnostic,
  b.booking_reference,
  o.order_reference,
  coalesce(o.payment_status, p.status, 'missing') as effective_payment_status,
  coalesce(p.provider, o.selected_payment_method, 'missing') as payment_method
from public.bookings b
left join public.orders o on o.id = b.order_id
left join lateral (
  select p1.status, p1.provider
  from public.payments p1
  where p1.booking_id = b.id
  order by p1.created_at desc
  limit 1
) p on true
where b.status = 'confirmed'
  and not (
    coalesce(o.payment_status = 'paid', false)
    or coalesce(p.status = 'paid', false)
    or coalesce(
      b.source = 'admin'
      and coalesce(p.provider, '') in ('cash', 'complimentary'),
      false
    )
  )
order by b.created_at desc;

-- 4. More than one successful payment for one order or standalone booking.
select
  'multiple_successful_payments' as diagnostic,
  coalesce(o.order_reference, b.booking_reference) as entity_reference,
  count(*) as successful_payment_count,
  array_agg(p.id order by p.created_at) as payment_ids
from public.payments p
left join public.orders o on o.id = p.order_id
left join public.bookings b on b.id = p.booking_id
where p.status in ('paid', 'partially_refunded', 'refunded')
group by coalesce(o.order_reference, b.booking_reference)
having count(*) > 1
order by successful_payment_count desc;

-- 5. Capacity cache outside its legal or booking-derived bounds.
select
  'over_capacity_or_cache_mismatch' as diagnostic,
  ws.id as workshop_session_id,
  ws.capacity,
  ws.reserved_count,
  coalesce(sum(b.quantity) filter (
    where b.status in ('pending', 'awaiting_payment', 'confirmed')
  ), 0) as active_booking_seats
from public.workshop_sessions ws
left join public.bookings b on b.workshop_session_id = ws.id
group by ws.id, ws.capacity, ws.reserved_count
having ws.reserved_count > ws.capacity
   or ws.reserved_count < 0
   or ws.reserved_count <> coalesce(sum(b.quantity) filter (
     where b.status in ('pending', 'awaiting_payment', 'confirmed')
   ), 0)
order by ws.starts_at;

-- 6. Negative product inventory (the table constraint should make this empty).
select
  'negative_inventory' as diagnostic,
  p.sku,
  p.inventory_quantity
from public.products p
where p.inventory_quantity < 0
order by p.sku;

-- 7. Terminal orders with a payment attempt that could still appear payable.
select
  'terminal_order_with_payable_attempt' as diagnostic,
  o.order_reference,
  o.status as order_status,
  o.payment_status,
  p.id as payment_id,
  p.status as payment_attempt_status
from public.orders o
join public.payments p on p.order_id = o.id
where o.status in ('cancelled', 'expired', 'refunded', 'partially_refunded')
  and p.status in ('created', 'pending', 'failed')
order by o.created_at desc;

-- 8. Failed webhook events that migration 19 can reclaim on retry.
select
  'retryable_stripe_event' as diagnostic,
  se.event_id,
  se.event_type,
  se.attempt_count,
  se.processed_at as last_attempt_at,
  left(coalesce(se.last_error, ''), 160) as safe_error_excerpt
from public.stripe_events se
where se.processing_status = 'failed'
order by se.processed_at desc nulls last;

-- 9. Processed events must not retain an error.
select
  'processed_stripe_event_with_error' as diagnostic,
  se.event_id,
  se.event_type,
  se.attempt_count,
  left(se.last_error, 160) as safe_error_excerpt
from public.stripe_events se
where se.processing_status = 'processed'
  and se.last_error is not null
order by se.processed_at desc;

-- 10. Duplicate success-type email rows. Recipients are intentionally omitted.
select
  'duplicate_order_success_email' as diagnostic,
  d.entity_reference,
  d.email_type,
  d.row_count
from (
  select
    o.order_reference as entity_reference,
    oe.email_type,
    count(*) as row_count
  from public.order_emails oe
  join public.orders o on o.id = oe.order_id
  where oe.email_type in ('payment_received', 'customer_confirmation')
  group by o.order_reference, oe.email_type, lower(oe.recipient)
  having count(*) > 1
) d
union all
select
  'duplicate_booking_success_email' as diagnostic,
  d.entity_reference,
  d.email_type,
  d.row_count
from (
  select
    b.booking_reference as entity_reference,
    be.email_type,
    count(*) as row_count
  from public.booking_emails be
  join public.bookings b on b.id = be.booking_id
  where be.email_type in ('confirmation', 'manual_confirmation')
  group by b.booking_reference, be.email_type
  having count(*) > 1
) d
order by diagnostic, entity_reference;

-- 11. Historical Stripe rows that are intentionally excluded from default
-- analytics until classified from an authoritative Stripe object.
select
  'stripe_livemode_unclassified' as diagnostic,
  coalesce(o.order_reference, b.booking_reference) as entity_reference,
  p.id as payment_id,
  p.status as payment_status,
  p.created_at
from public.payments p
left join public.orders o on o.id = p.order_id
left join public.bookings b on b.id = p.booking_id
where p.provider = 'stripe'
  and p.livemode is null
order by p.created_at desc;

-- 12. Linked order/booking analytics exclusions must agree.
select
  'analytics_exclusion_mismatch' as diagnostic,
  o.order_reference,
  b.booking_reference,
  o.analytics_excluded as order_excluded,
  b.analytics_excluded as booking_excluded
from public.orders o
join public.bookings b on b.order_id = o.id
where o.analytics_excluded is distinct from b.analytics_excluded
order by o.created_at desc, b.booking_reference;

-- 13. Past-due unpaid records still holding capacity. Migration 20 defines
-- 15-minute Stripe pre-Checkout holds / Checkout expiry and 24-hour
-- bank-transfer or shipping-quote deadlines. A non-empty result means the
-- expiry cron is delayed, a Stripe Session was safely deferred, or manual
-- review is required.
select
  'past_due_unpaid_capacity_hold' as diagnostic,
  b.booking_reference,
  o.order_reference,
  b.status as booking_status,
  o.status as order_status,
  coalesce(b.expires_at, o.expires_at) as expires_at,
  b.quantity
from public.bookings b
left join public.orders o on o.id = b.order_id
where b.status in ('pending', 'awaiting_payment')
  and coalesce(b.expires_at, o.expires_at) is not null
  and coalesce(b.expires_at, o.expires_at) < timezone('utc'::text, now())
order by coalesce(b.expires_at, o.expires_at);

-- 14. Partial or fulfilled unified-order refunds that still require explicit
-- item/booking allocation review. Full unfulfilled refunds are auto-released
-- exactly once and therefore do not appear.
select
  'unallocated_unified_order_refund' as diagnostic,
  o.order_reference,
  o.status as order_status,
  o.payment_status,
  p.id as payment_id,
  p.refunded_amount_grosz,
  p.amount_gross_grosz
from public.orders o
join public.payments p on p.order_id = o.id
where p.refunded_amount_grosz > 0
  and exists (
    select 1
    from public.order_events oe
    where oe.order_id = o.id
      and oe.event_type = 'refund_detected'
      and coalesce(
        (oe.metadata ->> 'requires_item_allocation_review')::boolean,
        false
      )
  )
order by o.created_at desc;

-- 15. Real disputes that still remove funds from net collected revenue or
-- warning inquiries that require a response. No PII is selected.
select
  'payment_dispute_requires_review' as diagnostic,
  coalesce(o.order_reference, b.booking_reference) as entity_reference,
  p.id as payment_id,
  d.dispute_id,
  d.status as dispute_status,
  d.amount_gross_grosz,
  d.currency,
  d.updated_at
from public.payment_disputes d
join public.payments p on p.id = d.payment_id
left join public.orders o on o.id = p.order_id
left join public.bookings b on b.id = p.booking_id
where d.status in (
  'needs_response',
  'under_review',
  'lost',
  'warning_needs_response',
  'warning_under_review'
)
order by d.updated_at desc;

rollback;
