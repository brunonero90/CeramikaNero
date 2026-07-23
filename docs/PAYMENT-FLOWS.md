# Payment Flows

## Payment provider

Stripe will be used for online payments. The integration will use Stripe
Checkout or Payment Element sessions created from the application.

## Checkout flow

1. Visitor selects a workshop and participant count.
2. Server creates a Stripe Checkout session with:
   - workshop name,
   - unit price,
   - quantity,
   - booking reference metadata.
3. Visitor is redirected to Stripe Checkout.
4. After successful payment, Stripe redirects back to the success page.
5. Webhook `checkout.session.completed` confirms the booking and sends a
   confirmation email.

## Webhook handling

- A single `api/webhooks/stripe` route will process Stripe events.
- Signature verification is mandatory.
- Events to handle:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `payment_intent.payment_failed`
  - `charge.refunded` (if refunds are enabled)

## Booking status mapping

| Event                         | Booking status |
| ----------------------------- | -------------- |
| checkout.session.completed    | confirmed      |
| checkout.session.expired      | cancelled      |
| payment_intent.payment_failed | cancelled      |

## Security

- Stripe secret keys are server-side only.
- Webhook endpoint uses the `STRIPE_WEBHOOK_SECRET` to verify events.
- Prices are calculated server-side; client-side totals are not trusted.

## Decisions to clarify (TBD)

- TBD: Whether to use Stripe Checkout or a custom Payment Element.
- TBD: Refund policy and how refunds are initiated.
- TBD: Tax handling (VAT, invoices, reverse charge for companies).
- TBD: Currency behaviour (PLN only or multi-currency).
- TBD: Whether to store partial payments or deposits.
- TBD: Handling of failed payments and retry logic.
