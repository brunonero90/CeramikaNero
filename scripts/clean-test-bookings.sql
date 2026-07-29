-- Ceramika Nero — clear test bookings / orders / payments
-- ---------------------------------------------------------------------------
-- Purpose: wipe transactional test data so workshops show full capacity and
--          the admin panel has no dirty bookings/orders/payments.
--
-- Keeps: workshops, sessions, products, media, redirects, site settings,
--        admin users.
-- Does NOT clear: Stripe Dashboard (test charges stay in Stripe).
-- Product inventory_quantity is NOT restored here — only reserved_count.
--
-- Where to run: Supabase Dashboard → SQL Editor
-- Project ref (this repo): zorxzyvmcbwucvaywmuu
--
-- WARNING: destructive. Use only on the shared test/staging project when you
-- intentionally want a clean slate. Do not run against a live production
-- database that already has real customer orders.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- 1) INSPECT (read-only)
-- =============================================================================

select count(*) as bookings from public.bookings;
select count(*) as orders from public.orders;
select count(*) as payments from public.payments;

select id, starts_at, capacity, reserved_count
from public.workshop_sessions
where reserved_count > 0
order by starts_at;

-- =============================================================================
-- 2) CLEAN SLATE (run as one transaction)
-- =============================================================================

begin;

-- Bookings / orders / payments / emails / Stripe ledger
truncate table
  public.order_emails,
  public.order_events,
  public.order_items,
  public.order_addresses,
  public.orders,
  public.booking_emails,
  public.booking_events,
  public.booking_cancellation_tokens,
  public.booking_participants,
  public.payments,
  public.stripe_events,
  public.bookings
restart identity cascade;

-- Optional: also wipe customer profiles created during tests
truncate table public.customer_profiles restart identity cascade;

-- Optional: clear admin audit noise from test actions
truncate table public.admin_audit_log restart identity;

-- Restore full workshop capacity
update public.workshop_sessions
set reserved_count = 0,
    updated_at = timezone('utc', now());

commit;

-- =============================================================================
-- 3) SANITY CHECK (expect all zeros)
-- =============================================================================

select
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.payments) as payments,
  (select coalesce(sum(reserved_count), 0) from public.workshop_sessions) as reserved_seats;

-- =============================================================================
-- NOTES
-- =============================================================================
-- After running:
--   - Refresh Admin → Rezerwacje / Zamówienia (should be empty)
--   - Public session capacity should be full again
--
-- If you also bought shop products during tests and stock looks wrong, restore
-- product.inventory_quantity manually for those SKUs (this script does not).
--
-- Stripe: ignore old test payments in Dashboard Test mode, or filter by date.
-- They are independent of this database wipe.
