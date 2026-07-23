# Booking Rules

## Workshop categories

- **Dla dzieci** — workshops aimed at children.
- **Dla dorosłych** — workshops aimed at adults.
- **Dla rodzin** — family workshops (future phase).
- **Grupy i firmy** — private events and team building.
- **Wydarzenia specjalne** — seasonal or one-off events.

## Booking flow

1. Visitor selects a workshop instance from the calendar or list.
2. Visitor provides contact details and participant count.
3. System checks capacity and reserves the slot for a short period.
4. Visitor completes payment via Stripe.
5. Booking status changes to confirmed and a confirmation email is sent.

## Capacity rules

- Each workshop instance has a maximum capacity.
- Bookings are only accepted if the requested number of participants fits the
  remaining capacity.
- Overbooking is not permitted.

## Rules to clarify (TBD)

- TBD: Cancellation policy (time window, refund amount, administrative fee).
- TBD: Refund rules for no-shows and last-minute cancellations.
- TBD: Age limits for each workshop category and how they are enforced.
- TBD: Payment deadline before a pending booking is released.
- TBD: How far in advance a workshop can be booked.
- TBD: Group booking minimum and maximum participant counts.
- TBD: Voucher, discount code and gift-card rules.
- TBD: Rescheduling policy and modification rules.
