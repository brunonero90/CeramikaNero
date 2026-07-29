# Analytics — Ceramika Nero

Operational and financial analytics for studio management. Metrics use
**Europe/Warsaw** business dates unless noted.

This document describes **Studio Operations & Analytics v1**. It intentionally
does **not** claim visitor conversion, marketing attribution, abandoned-cart
rates before order creation, or profit/contribution margin.

## Source tables

| Domain | Tables |
|--------|--------|
| Money | `payments` (`amount_gross_grosz`, `refunded_amount_grosz`, `paid_at`, `status`, `provider`, `livemode`) |
| Orders | `orders` (`analytics_excluded`, `selected_payment_method`, `payment_status`) |
| Bookings | `bookings` (`status`, `quantity`, `analytics_excluded`, `created_at`, `cancelled_at`) |
| Attendance | `booking_participants` (`attendance_status`, …) |
| Sessions | `workshop_sessions` (`capacity`, `reserved_count`, `starts_at`, `attendance_reviewed_at`) |

Semantic helper view: `analytics_payment_facts` (migration 18, service_role).

## Exclusions (default dashboard)

Excluded unless “Uwzględnij dane testowe / wykluczone” is enabled:

1. `orders.analytics_excluded = true` / linked `bookings.analytics_excluded = true`
2. Stripe payments with `livemode = false`
3. Stripe payments with `livemode IS NULL` (unclassified historical rows)

Manual / offline payments without Stripe are included when not analytics-excluded.

Do **not** guess livemode for historical Stripe rows. Classify via webhook going
forward (`event.livemode` / session.livemode) or an audited admin exclusion.

## Metric definitions

| KPI | Formula |
|-----|---------|
| Net collected revenue | Σ (`amount_gross_grosz` − `refunded_amount_grosz`) for eligible paid/partially_refunded/refunded payments with `paid_at` in range |
| Refunds | Σ `refunded_amount_grosz` for those payments |
| Paid orders | Distinct `order_id` among eligible paid payments in range |
| Operational occupancy | Σ `reserved_count` / Σ `capacity` for sessions starting in range |
| Realised attendance | Checked-in participants / Σ capacity (sessions in range) |
| Cancellation rate | Cancelled bookings (`cancelled_at` in range) / bookings created in range |
| No-show rate | `no_show` participants / expected participants on sessions with `attendance_reviewed_at` set |
| Average booking value | Net collected revenue / paid orders |
| Repeat customer | Documented for a later refinement; v1 UI may show placeholder until cohort query is completed |
| Lead time | Days between booking `created_at` and session `starts_at` (bucketed in later iterations) |

Revenue is **never** labeled as profit. Profitability requires explicit session
costs (instructor, venue, materials, refreshments) in a later phase.

## Timezone

All filter “from/to” dates are interpreted as Warsaw local midnights converted
to UTC for queries. Charts and tables label days in `yyyy-MM-dd` Warsaw.

## Day-of operations

Admin screens `/admin/dzisiaj` and `/admin/terminy/[id]` roster:

- Group bookings: Gotowi / Wymaga uwagi / Usunięte
- Attendance mutations via RPCs; never change payment, capacity, or booking status
- Audited without storing customer PII in audit summaries

## Privacy

- Analytics endpoints and dashboard payloads contain **no** names, emails, phones,
  or free-text notes.
- Day-of roster is owner/manager only and may show contact details for operations.
- Future behavioral events must never include PII. Marketing consent ≠ analytics consent.

## Future behavioral event catalog (not implemented)

Consent-aware, non-PII events only:

- `workshop_viewed`
- `session_selected`
- `add_to_cart`
- `checkout_started`
- `order_created`
- `payment_succeeded`

Do not implement browser tracking until a dedicated analytics-consent mechanism
exists.

## Data retention

Operational booking/payment rows are retained for studio accounting and support.
Analytics exclusions flag rows without deleting them. Prefer exclusion over hard
deletes for auditability.

## Admin classification workflow

1. Identify unclassified Stripe payments (`livemode` null) via the analytics banner.
2. Prefer letting new webhooks stamp `livemode`.
3. For known test CN-O / CN bookings, use `set_analytics_excluded` (order or booking)
   so linked siblings stay consistent.
4. Re-run analytics with include-test off to verify KPI cleanliness.

## Deployment notes

Apply migration `00000000000018_studio_operations_analytics.sql` before relying on
attendance RPCs or `livemode` / `analytics_excluded` columns.
