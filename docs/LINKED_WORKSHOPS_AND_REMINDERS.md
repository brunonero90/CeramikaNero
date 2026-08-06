# Linked workshops and booking reminders

This sprint keeps adult participant UX, multi-stage workshops, payments, capacity
and reminders inside the existing unified booking/order flow.

## Participant collection

Workshops now have two operational settings:

- `participant_audience`: `adult`, `child` or `mixed`;
- `collect_participant_age`: whether age is required for child participants.

Checkout behaviour:

- one adult place uses the purchaser's first and last name; the participant name
  is not requested again and no age is stored;
- bookings for multiple adults ask only for the additional participant names;
- child workshops collect each child's name and, when enabled, age;
- mixed workshops ask whether each participant is an adult or child and show the
  age field only for children.

Existing workshops default to `adult`. Migration 26 marks obvious child/family
catalog entries as child or mixed and enables age collection for them. The owner
or manager can verify and adjust the setting in the workshop editor.

## Reusable multi-stage workshops

The workshop editor exposes:

- `workshop_type`;
- `requires_followup_session`;
- `followup_workshop_type`;
- `followup_min_days`;
- `followup_max_days`.

An exact `followup_workshop_id` is also supported at database level. The public
checkout resolves an exact ID first, then the configured type or slug.

When a workshop requires a follow-up stage:

1. checkout presents published follow-up sessions inside the configured day
   window;
2. the customer must select one before voucher validation or order submission;
3. the primary and follow-up sessions are submitted in one atomic cart order;
4. each session reserves its own capacity;
5. both prices are included in the order total (a zero-price follow-up is shown as
   included in the price);
6. `booking_links` records the relationship for administration and lifecycle
   operations;
7. the existing order confirmation lists both workshop order items;
8. cancellation traverses the complete linked chain and releases every session
   exactly once;
9. the existing order expiry/refund path processes every booking in the order.

Server-side revalidation checks the selected follow-up again immediately before
the database transaction. If capacity disappeared, checkout returns a Polish
message asking the customer to choose another second-stage session. Once the
order is created, both capacities are held by the same order while payment is
pending.

### Glina do Wina setup

Migration 26 automatically links `Glina do Wina` only when a published glazing
workshop already exists with a slug/title/type containing `szkliw`.

If production has no separate glazing workshop yet:

1. create or publish the glazing workshop and its future sessions;
2. set its operational type, for example `szkliwienie`;
3. edit `Glina do Wina`;
4. enable **Wymaga drugiego terminu**;
5. set the follow-up type to `szkliwienie`;
6. set the permitted minimum and maximum day interval;
7. save and verify checkout with a disposable reservation.

This avoids silently linking customer orders to an unrelated workshop.

## Reminder emails

The production scheduler was audited and is enabled in `netlify.toml`:

- Netlify function: `booking-email-dispatch`;
- schedule: `*/5 * * * *`;
- authenticated endpoint: `/api/cron/email-dispatch`;
- secret: `BOOKING_CRON_SECRET`.

Each run calls `enqueue_booking_reminders` before dispatching email retries.
Reminders are queued for confirmed bookings whose session starts between 23 and
25 hours from processing time. The five-minute schedule therefore sends them
approximately one day before the workshop.

The implementation is payment-provider neutral. A confirmed manual booking and
a confirmed Stripe booking are selected by the same query.

Idempotency and safety:

- a partial unique index allows only one `reminder` ledger row per booking;
- rerunning the cron cannot queue a duplicate;
- only `confirmed` bookings and scheduled/sold-out future sessions qualify;
- cancelled, expired, refunded and partially refunded bookings are excluded;
- dispatch rechecks status immediately before sending;
- a queued reminder that becomes ineligible is permanently closed and logged as
  `reminder_skipped`;
- successful sends log `reminder_sent` in `booking_events` and a structured
  `[booking-reminder] sent` application log;
- normal email retry/backoff and provider message IDs remain in
  `booking_emails`.

## Admin visibility

The booking detail page displays linked stages with workshop, date, status and a
link to the related booking. Email history includes reminder rows and their
status. Booking events show queue, sent and skipped reminder events.

## Validation

Run:

```bash
npm run typecheck
npm run test:migrations
npm run test:vouchers:pglite
npm run test:linked-workshops:pglite
npm test
npm run build
```

The linked-workshop PGlite test verifies:

- adult names with null persisted ages;
- two bookings in one order;
- independent capacity reservation;
- one explicit booking link;
- checkout replay idempotency;
- linked cancellation and capacity release;
- one reminder each for confirmed Stripe and manual bookings;
- no reminder for cancelled bookings;
- duplicate cron runs and cancellation-before-send handling.

## Deployment

1. Back up the production database.
2. Apply voucher migrations 20–25 first if they are not already applied.
3. Apply `00000000000026_linked_workshops_and_reminders.sql`.
4. Apply `00000000000027_linked_workshop_hardening.sql`.
5. Deploy the application commit.
6. Confirm `BOOKING_CRON_SECRET` exists in Netlify and the scheduled function is
   enabled.
7. Review adult/child/mixed settings in the workshop admin.
8. Configure the real glazing workshop and Glina do Wina relationship.
9. Perform one disposable two-stage Stripe booking and one manual booking.
10. Check `booking_emails`, `booking_events`, both capacities and the admin linked
    booking display.
