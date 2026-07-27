# Ceramika Nero — Booking and Payment System

This document describes the transactional booking and payment system implemented in Phase 5.

## Overview

The system supports:

- Public guest checkout without Supabase Auth accounts.
- Atomic capacity reservation in PostgreSQL.
- 15-minute unpaid holds with automatic expiry.
- Stripe Checkout hosted payments.
- Verified, idempotent Stripe webhooks.
- Customer cancellation with a secure email token.
- Staff cancellation and full/partial Stripe refunds.
- Manual/offline bookings created by managers and owners.
- Resend transactional emails.
- Rate limiting and abuse prevention via Upstash Redis.

## Booking lifecycle

```
                  begin_booking
                       │
                       ▼
                  ┌─────────┐
     payment      │ pending │◄──────────────┐
     succeeds     │  hold   │               │
     via webhook  └────┬────┘               │
                       │                     │
                       ▼                     │ Stripe
                 ┌──────────┐                │ Checkout
                 │ confirmed│                │ expires
                 └────┬─────┘                │
                      │                      │
        ┌─────────────┼─────────────┐        │
        ▼             ▼             ▼        │
    cancelled     refunded    partially     │
                  / manual      refunded     │
    resolution    cancellation               │
                       ▲                     │
                       │                     │
              expiry/expires_at──────────────┘
```

### States

| Status               | Meaning                                                   |
| -------------------- | --------------------------------------------------------- |
| `pending`            | Unpaid 15-minute hold. Capacity is reserved.              |
| `awaiting_payment`   | Used for offline/manual bookings waiting for payment.     |
| `confirmed`          | Payment verified (Stripe webhook or manual confirmation). |
| `cancelled`          | Booking cancelled by customer or staff.                   |
| `expired`            | The 15-minute hold elapsed without payment.               |
| `refunded`           | Full amount refunded.                                     |
| `partially_refunded` | A partial refund was issued.                              |

Allowed transitions are enforced by the database functions and server actions.

## Payment lifecycle

| Status               | Meaning                                    |
| -------------------- | ------------------------------------------ |
| `created`            | Payment record created during booking.     |
| `pending`            | Manual/offline booking awaiting payment.   |
| `paid`               | Stripe webhook or staff confirmed payment. |
| `failed`             | Stripe payment failed or Checkout expired. |
| `refunded`           | Full refund recorded.                      |
| `partially_refunded` | Partial refund recorded.                   |

Stripe is always the authoritative source of truth. The success page is presentation-only.

## Capacity invariants

- Capacity is reserved atomically by `public.begin_booking`.
- `reserved_count` is incremented only when a booking is created.
- `reserved_count` is decremented exactly once when a booking is cancelled or expired.
- `reserved_count` never goes below zero (`greatest(0, reserved_count - quantity)`).
- A customer can book up to 10 participants per booking; sessions with lower capacity are respected.
- Concurrent bookings cannot oversell because the function locks the session row.

## Expiry workflow

1. `public.begin_booking` sets `bookings.expires_at` to `now() + 15 minutes` for `pending` bookings.
2. The protected cron endpoint `/api/cron/expiry` runs `public.expire_pending_bookings()`.
3. The function marks eligible bookings as `expired` and decrements `reserved_count` exactly once.
4. The function is safe under concurrent calls and simultaneous webhook processing.
5. In production, schedule the cron at least every 5 minutes. Actual release can therefore occur shortly after `expires_at`.

## Webhook idempotency

- Every Stripe event ID is recorded in `public.stripe_events`.
- Duplicate event IDs are ignored.
- Database functions are atomic and use row locks, so duplicate events cannot:
  - confirm a booking twice,
  - release capacity twice,
  - send a confirmation email twice,
  - apply a refund twice.
- Out-of-order events are handled by explicit state checks.

## Late-payment recovery

If a `checkout.session.completed` webhook arrives after the booking expired:

1. `public.confirm_booking_from_payment` attempts to reacquire capacity.
2. If capacity is available, the booking is confirmed.
3. If capacity is unavailable, the payment is marked as `paid` but the booking remains expired. The payment record receives a `failure_message` stating that manual resolution is required and a payment-problem email is sent.
4. Staff must resolve the situation manually (refund, move to another session, or release a spot).

## Cancellation and refund rules

### Customer cancellation

- Customers receive a secure, expiring cancellation link in the confirmation email.
- The link contains a hashed token stored in `public.booking_cancellation_tokens`.
- Automatic full refund is possible only when cancelling at least 24 hours before the session starts.
- Within 24 hours, the page explains that automatic cancellation/refund is unavailable and provides the configured contact path.
- Cancellation releases capacity exactly once and is idempotent.

### Staff cancellation

- Managers and owners can cancel a booking from the admin panel.
- A reason is required and recorded in the audit log.
- Staff can issue full or partial refunds through Stripe.
- The cumulative refunded amount cannot exceed the captured amount.
- A failed Stripe refund does not mark the booking as refunded.

## Manual bookings

- Managers and owners can create bookings via `/admin/rezerwacje/nowa`.
- Supported payment methods: `cash`, `bank_transfer`, `card_terminal`, `complimentary`, `other`.
- Status can be `pending` or `confirmed` at creation time.
- Confirmed manual bookings reserve capacity immediately.
- The staff actor is recorded in the booking event log and audit log.
- Complimentary bookings record zero price and the staff actor.

## Moving a booking

- Staff can move a confirmed or awaiting-payment booking to another session of the **same workshop**.
- The destination session must have enough capacity.
- Moving between sessions with different prices is blocked to avoid unsafe automatic charging/refunding.
- The move is atomic: source capacity is released, destination capacity is reserved, and the booking event log records the move.

## Email behaviour

- Resend sends Polish transactional emails:
  - Booking confirmed
  - Booking cancelled
  - Refund issued
  - Manual booking confirmed
  - Payment problem requiring action
- Each email type is recorded in `public.booking_emails` to prevent duplicate sends.
- Failed emails do not roll back a successful payment.
- Staff can retry emails from the booking detail page.
- Email templates include: booking reference, workshop/session details, Europe/Warsaw time, location, participant count, amount, and a secure cancellation link where applicable.

## Rate limiting

- Public booking creation and cancellation endpoints are rate-limited.
- Rate limiting uses Upstash Redis (Sliding Window) with a combination of:
  - IP hash,
  - email hash,
  - session ID,
  - booking token.
- Production requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- A hidden honeypot field (`website`) rejects obvious spam.
- CAPTCHA integration is prepared but not enabled by default.

## Personal data handling

- Collected data: full name, email, phone, participant display names, participant ages (only when required by workshop limits), and consent timestamps.
- No dates of birth, addresses, or unnecessary sensitive data are collected.
- Marketing consent is separate from transactional consent and stored with a timestamp.
- Personal data is not placed in URLs, Stripe metadata, application logs, or analytics.
- Booking status is returned only via secure, scoped endpoints using the Stripe Checkout Session ID or a validated reference.
- Financial records are not automatically deleted. A future anonymisation process should preserve accounting integrity.

## Admin permissions

- Owner: full access to bookings and refunds.
- Manager: operational booking management (create, cancel, refund, move, confirm payment, retry email).
- Editor: no access to bookings.

## Files and routes

- Migration: `supabase/migrations/00000000000005_booking_system.sql`
- Public booking page: `/warsztaty/[slug]/rezerwacja`
- Stripe webhook: `/api/webhooks/stripe` (raw-body signature verification; handles immediate and async Checkout outcomes)
- Expiry cron: `/api/cron/expiry`
- Customer cancellation: `/rezerwacja/anulowanie`
- Success/cancel pages: `/rezerwacja/sukces`, `/rezerwacja/anulowana`
- Admin list: `/admin/rezerwacje`
- Admin detail: `/admin/rezerwacje/[id]`
- Manual booking: `/admin/rezerwacje/nowa`
- Core code: `lib/booking/*`, `lib/stripe/*`, `lib/resend/*`

## Operational limitations

- Self-service rescheduling by customers is not implemented.
- Waiting lists are not implemented.
- Deposits, instalments, discount codes and gift cards are not implemented.
- Moving a booking between sessions with different prices is blocked.
- The success page is presentation-only; the webhook is authoritative.

## Unified cart path (2026)

Scheduled fixed-price workshops can be added to the cart from `/warsztaty/{slug}/rezerwacja` (session + quantity). Purchaser/participant details are collected at `/cart/checkout`. Submission calls `submit_cart_order`, which creates one `orders` row and one `bookings` row per workshop line (capacity reserved only then). Enquiry-only offers must not use this path.
