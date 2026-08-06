# Gift vouchers

Gift vouchers are implemented as a payment instrument in the unified order flow.
They are not discount coupons. Migrations 20-voucher through 25 add the voucher
ledger, provider registry, redemption history, audit logs, checkout RPC,
lifecycle synchronization and idempotent mixed-payment replay handling.

## Supported providers

- `ceramika_nero`: direct vouchers generated or imported by the studio.
- `prezent_marzen`: partner vouchers imported into the admin portal.
- future providers: add a row to `gift_voucher_providers`; no booking-engine
  change is required.

Both initial providers use the `database` adapter. This is intentional: no public
Prezent Marzeń voucher API contract or production credentials are assumed.
Partner codes are imported by an owner or manager before use.

## Customer flow

The checkout offers **Mam bon upominkowy** for workshop-only carts. The code is
validated server-side. The preview shows the provider, masked code, available
balance, expiry, restrictions, value applied and remaining amount due.

- Full coverage: the order and bookings are confirmed immediately. Stripe is not
  opened.
- Partial coverage: the voucher is reserved and Stripe or bank transfer covers
  only the remainder.
- Multi-use: unused balance remains active.
- Single-use: the code is consumed on the first reservation and fully restored if
  that unpaid reservation is cancelled or expires.

The browser preview is advisory. `submit_cart_order_v3` revalidates and locks the
voucher in the same PostgreSQL transaction that creates the order and reserves
workshop capacity.

## Lifecycle and refunds

A voucher redemption is `reserved`, `committed`, `released` or `refunded`.

- payment confirmation commits a partial voucher reservation and synchronizes
  the voucher payment ledger;
- cancellation or payment expiry restores the balance;
- a full order refund either restores the original voucher or creates a new
  Ceramika Nero replacement, according to `refund_policy`;
- generated/replacement raw codes are held in the service-only
  `voucher_issue_secrets` table and shown only in the protected voucher admin
  page;
- idempotent checkout retries always resolve the non-voucher payment row and
  cannot rewrite the voucher ledger as Stripe or bank transfer.

The existing full-refund policy remains unchanged. A partial Stripe refund does
not guess how to allocate value between participants or voucher/cash components;
it remains a manual-resolution case.

## Security

- Only SHA-256 hashes and the last four code characters are stored in
  `gift_vouchers`.
- Full codes are never written to order events, provider logs or customer emails.
- Checkout and admin RPCs are service-role only.
- Validation uses the existing booking rate limiter.
- Active redemptions and submission keys are unique.
- Provider logs store a short request fingerprint, not the voucher code.

## External HTTP provider adapter

The generic `http_json` adapter is disabled until a provider row is explicitly
configured. Its endpoint must be HTTPS and its hostname must appear in
`VOUCHER_PROVIDER_ALLOWED_HOSTS`. Secrets are read from the environment variable
named by `api_secret_env_key`; secrets are never stored in PostgreSQL.

Requests use one JSON endpoint with an `action` field:

```json
{ "action": "validate", "code": "..." }
{ "action": "redeem", "code": "...", "amount_grosz": 25000, "idempotency_key": "..." }
{ "action": "cancel", "code": "...", "provider_reference": "...", "idempotency_key": "..." }
```

Validation response:

```json
{
  "valid": true,
  "provider_reference": "partner-reference",
  "description": "Voucher description",
  "voucher_type": "fixed_amount",
  "original_value_grosz": 50000,
  "remaining_value_grosz": 50000,
  "currency": "PLN",
  "valid_from": null,
  "valid_until": "2027-08-06T00:00:00Z",
  "multi_use": true,
  "allowed_workshop_types": [],
  "allowed_workshop_ids": [],
  "metadata": {}
}
```

Mutation response:

```json
{
  "ok": true,
  "provider_reference": "partner-redemption-reference",
  "status": "reserved"
}
```

Do not switch a provider to `http_json` until its real API semantics, timeout,
idempotency and cancellation behaviour have been verified in a sandbox.

## Deployment

1. Back up the database.
2. Run `npm run test:migrations` and `npm run test:vouchers:pglite`.
3. Apply the following additive migrations in filename order:
   - `00000000000020_voucher_pgcrypto_compat.sql`
   - `00000000000021_gift_voucher_integration.sql`
   - `00000000000022_voucher_refund_compatibility.sql`
   - `00000000000023_voucher_payment_method_constraint.sql`
   - `00000000000024_voucher_payment_ledger_sync.sql`
   - `00000000000025_voucher_replay_payment_selection.sql`
4. Deploy the application commit containing the checkout/admin changes.
5. Import a disposable test voucher in `/admin/vouchery`.
6. Test full voucher, partial Stripe, expiry restoration and full refund.

## Automated lifecycle coverage

`npm run test:vouchers:pglite` applies the complete migration chain and executes:

- full Prezent Marzeń voucher confirmation without cash payment;
- partial Ceramika Nero voucher plus the exact Stripe remainder;
- replay idempotency without duplicate value or capacity consumption;
- rejection of a second order using an exhausted voucher;
- voucher ledger commitment after Stripe confirmation;
- full and mixed-payment refund restoration;
- unpaid expiry restoration and replay safety.

## Manual acceptance checklist

1. Full Ceramika Nero voucher confirms booking without opening Stripe.
2. Partial voucher opens Stripe for exactly the remainder.
3. The confirmation email shows provider and masked code only.
4. Reusing a submission does not consume the voucher twice.
5. Two concurrent attempts cannot overspend one voucher.
6. Invalid, expired, cancelled and restricted vouchers fail with safe messages.
7. Expired/cancelled unpaid orders restore voucher balance and workshop capacity.
8. Full refund restores or replaces voucher value according to policy.
9. Prezent Marzeń offline-imported code works identically to an internal voucher.
10. Admin search, history, cancellation, extension and CSV export work.
