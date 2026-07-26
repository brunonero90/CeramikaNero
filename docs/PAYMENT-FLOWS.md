# Payment Flows

## Current provider

**Manual bank transfer.** Stripe and other card providers are **not** activated.

Customers submit an unpaid order/reservation. The studio confirms the amount
(including shipping when needed) and shares verified transfer instructions.

## Checkout flow (unified cart)

1. Visitor selects workshop sessions and/or products (Glina Box, optional firing).
2. Cart is held in browser `localStorage` without PII.
3. Checkout collects purchaser details, participants (workshops), and delivery
   address only when shipping is selected.
4. Server revalidates prices/availability and calls `submit_cart_order` with an
   idempotency key.
5. Capacity and inventory change atomically inside the RPC.
6. Customer is redirected to `/zamowienie/[publicLookupToken]` (opaque token).
7. Email jobs are queued in `order_emails`; delivery failure does not roll back
   the order.

## Shipping quotes

- Delivery fee is **not** fixed and must not be invented in the UI.
- Shipped product lines set `shipping_quote_required = true`.
- Customer sees: *Koszt wysyłki zostanie potwierdzony przed płatnością.*
- No final delivery-inclusive total and no transfer request until an admin
  confirms the fee in `/admin/zamowienia/[id]`.
- Confirmed fee recalculates `total_gross_grosz` server-side and queues
  `shipping_quote_confirmed` exactly once.

## Pickup / workshop-only

- Authoritative total equals the known subtotal.
- Bank-transfer instructions are shared after studio confirmation.

## Status mapping (orders)

| Admin action              | Typical resulting state                          |
| ------------------------- | ------------------------------------------------ |
| Checkout submitted        | `awaiting_payment` / payment `pending`           |
| Shipping quote confirmed  | `shipping_quote_required = false`, total updated |
| Mark paid                 | payment `paid`, optional `payment_received` mail |
| Cancel order              | status `cancelled`                               |

## Security

- Prices and shipping fees are never browser-authoritative.
- Public status pages require the opaque lookup token (hashed at rest).
- Anonymous clients cannot read orders, addresses, or email ledger rows.
