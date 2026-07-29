# Payment Flows

## Provider configuration

Server env `PAYMENTS_PROVIDER`:

| Value    | Behaviour                                                                |
| -------- | ------------------------------------------------------------------------ |
| `manual` | Bank transfer only (default)                                             |
| `stripe` | Stripe Checkout when `STRIPE_SECRET_KEY` is set; fails closed if missing |
| `both`   | Customer explicitly chooses Stripe or bank transfer at checkout          |

Never silently fall back to bank transfer because Stripe is misconfigured.
Never show customers messages such as “Stripe nie jest aktywowany”.

Stripe webhook: `https://ceramikanero.pl/api/webhooks/stripe`

Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`,
`payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.

## Checkout flow (unified cart — CN-O)

1. Visitor selects workshop sessions and/or products.
2. Cart is held in browser `localStorage` without PII.
3. Checkout collects purchaser details, participants, delivery address (if shipping),
   and — when `PAYMENTS_PROVIDER=both` — an explicit payment method.
4. Server revalidates prices/availability and calls `submit_cart_order`.
5. Capacity and inventory change atomically inside the RPC (once).
6. App persists `orders.selected_payment_method` and updates the payment row.
7. **Known total + Stripe:** create/reuse Checkout Session and redirect to Stripe.
8. **Known total + bank transfer:** redirect to `/zamowienie/[token]` with full
   transfer instructions (recipient, account, title, amount).
9. **Shipping quote required:** do not create Checkout or request payment yet;
   email explains the studio is calculating shipping.

## Confirmation paths

1. **Primary:** verified Stripe webhook → `confirm_order_from_payment`
2. **Return-path backup:** success URL includes `session_id`; the order page
   retrieves the Checkout Session with the Stripe secret key and confirms when
   `payment_status=paid`. Browser flags alone never mark an order paid.
3. **Admin:** “Mark paid” only for **bank_transfer** orders (blocked for unpaid
   Stripe attempts).

Webhook endpoint: `https://ceramikanero.pl/api/webhooks/stripe`

## Shipping quotes

- Shipped product lines set `shipping_quote_required = true`.
- No final total / no bank account / no Stripe Checkout until admin confirms fee.
- Confirmed fee recalculates totals server-side and queues
  `shipping_quote_confirmed` with transfer instructions or “Zapłać online”.

## Holds

- Manual bank-transfer cart orders: no timed hold (`expires_at` null).
- Stripe cart Checkout: order/booking `expires_at` aligned to Checkout session
  (~30 minutes, Stripe minimum).
- Cron / `expire_pending_bookings` (migration 19): expires `pending` **and**
  `awaiting_payment` bookings past `expires_at`, releases capacity once, fails
  open payment attempts, expires unpaid `awaiting_payment` orders and restores
  tracked product inventory once.
- Stripe `checkout.session.expired` fails the payment attempt; seats/inventory
  follow the expire/cancel path above rather than a second independent release.

## Cancellation

- Admin order cancel uses `cancel_order_and_release` (migration 19): cancels
  active linked bookings via `cancel_booking` (capacity once), restores tracked
  product inventory, cancels open payment attempts, writes an order event.
- Customer/admin booking cancel continues to use `cancel_booking`.

## Refunds (`charge.refunded`)

- Webhook updates payment/order refund totals from Stripe `amount_refunded`
  (delta vs local `refunded_amount_grosz`).
- Booking-linked payments use `record_payment_refund`.
- **Capacity and inventory are not auto-restored on refund.** Cancel the booking
  or order explicitly when seats/stock should return.
- Disputes/chargebacks are **not** handled by the app — resolve in Stripe Dashboard
  and record operational notes manually (see release audit).

## Bank transfer settings

Admin → Ustawienia (or `site_settings` keys):

- `bank_transfer_enabled`
- `bank_transfer_recipient` (required)
- `bank_transfer_account` (required, 26-digit NRB / PL+26)
- `bank_transfer_bank_name` (optional)
- `bank_transfer_title_template` (default `{{order_reference}}`)
- `bank_transfer_deadline_note` (optional)
- `bank_transfer_instructions` (optional free-form note)

Incomplete configuration blocks offering manual payment and never emails
partial instructions.

## Emails

Branded HTML + plain text via `lib/email` (React Email). Outboxes:
`order_emails`, `booking_emails`. Cron: `/api/cron/email-dispatch`.

## Stripe sandbox test matrix

Run every scenario with Stripe test keys and create a new CN-O order for each
test. Use any future expiry (for example `12/34`) and any three-digit CVC for
card tests.

| Scenario                         | Checkout test data                                                                                    | Expected application result                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Successful card                  | Visa `4242 4242 4242 4242`                                                                            | Order/payment and linked booking become paid/confirmed exactly once; payment CTA disappears; confirmation email is sent |
| Failed card                      | Visa `4000 0000 0000 0002`                                                                            | Stripe reports `card_declined`; order is not confirmed; capacity/inventory is not changed again; retry remains possible |
| Failed card — insufficient funds | Visa `4000 0000 0000 9995`                                                                            | Stripe reports `insufficient_funds`; the same failure safeguards apply                                                  |
| Successful BLIK                  | Normal customer email + code `123456`                                                                 | BLIK is approved, webhook/return reconciliation confirms once, and the success email is sent                            |
| Failed BLIK — customer decline   | Enter `customer_declined@example.com` as the checkout email, choose BLIK, then use any six-digit code | Stripe declines after about eight seconds; order remains unpaid and retryable; failure email is queued once             |
| Failed BLIK — invalid code       | Enter `invalid_code@example.com` as the checkout email, choose BLIK, then use any six-digit code      | Stripe returns an immediate invalid-code failure; order remains unpaid                                                  |
| BLIK timeout                     | Enter `customer_timeout@example.com` as the checkout email, choose BLIK, then use any six-digit code  | Stripe times out after about 60 seconds; order remains unpaid and retryable                                             |

For every failed scenario, verify the corresponding Stripe event was delivered
to `/api/webhooks/stripe` with a `2xx`, no paid transition or success email was
created, the linked booking was not confirmed, and a later successful retry
confirms the order only once.

## Security

- Prices, shipping, inventory, and Stripe line items are never browser-authoritative.
- Stripe metadata contains only non-PII ids (`entity_type`, order/booking id,
  reference, payment id).
- Public status pages require the opaque lookup token.
- Omit `payment_method_types` so Dashboard dynamic methods control card / BLIK / P24.
