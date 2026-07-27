# Email activation (Resend) — Ceramika Nero

Transactional booking emails use the existing `booking_emails` / `order_emails`
ledgers, Resend transport, and Netlify scheduled retry worker. Do not replace
this architecture — only configure credentials and verify delivery.

## Architecture (already implemented)

| Step                   | Where                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Queue outbox row       | `lib/booking/email.ts` (`recordBookingEmail`) and `lib/cart/order-email.ts`                                                                          |
| Immediate send attempt | `lib/booking/email-transport.ts` → Resend                                                                                                            |
| Retry worker           | Netlify scheduled function `booking-email-dispatch` (every 5 min) → `POST /api/cron/email-dispatch` with `Authorization: Bearer BOOKING_CRON_SECRET` |
| Admin recipient        | `BOOKING_ADMIN_EMAIL` via `getBookingAdminEmail()`                                                                                                   |
| Customer confirmation  | `confirmation`                                                                                                                                       |
| Studio notification    | `admin_notification`                                                                                                                                 |
| Cancellation           | `cancellation`                                                                                                                                       |
| Also present           | `refund`, `payment_problem`, order email types                                                                                                       |

Idempotency: a second send is skipped when a `sent` ledger row already exists for the same booking + email type.

## Required Netlify environment variables

Set these on the Netlify site (Production), then redeploy:

| Variable                | Exact production value                                            |
| ----------------------- | ----------------------------------------------------------------- |
| `RESEND_API_KEY`        | Resend production API key (server-only)                           |
| `RESEND_FROM_EMAIL`     | `Ceramika Nero <rezerwacje@ceramikanero.pl>`                      |
| `RESEND_REPLY_TO_EMAIL` | `kontakt@ceramikanero.pl`                                         |
| `BOOKING_ADMIN_EMAIL`   | `kontakt@ceramikanero.pl`                                         |
| `NEXT_PUBLIC_SITE_URL`  | `https://ceramikanero.pl`                                         |
| `BOOKING_CRON_SECRET`   | Existing long random secret (must match scheduled function calls) |

Optional indexing control while `.pl` is for testing (`.com` remains SEO primary):

| Variable                | Meaning                                             |
| ----------------------- | --------------------------------------------------- |
| _(default)_             | Host `ceramikanero.pl` is **noindex** automatically |
| `SITE_ALLOW_INDEXING=1` | Allow indexing on `.pl` when ready                  |
| `SITE_NOINDEX=1`        | Force noindex on any host                           |

`RESEND_API_KEY` must never be prefixed with `NEXT_PUBLIC_`.

## Minimum steps for Bruno

1. Confirm Resend domain `ceramikanero.pl` is **Verified**.
2. Set the Netlify variables above exactly.
3. Redeploy Netlify (so build-time env such as `NEXT_PUBLIC_SITE_URL` and robots metadata apply).
4. Confirm scheduled function `booking-email-dispatch` is present (declared in `netlify.toml` as `*/5 * * * *`).
5. Run a controlled smoke booking to an inbox **you** control (never a real customer).
6. Confirm:
   - customer confirmation arrives from `rezerwacje@ceramikanero.pl`
   - Reply-To is `kontakt@ceramikanero.pl`
   - admin notification arrives at `kontakt@ceramikanero.pl`
   - ledger rows show `status = sent` with a Resend message id
7. Optional worker poke:

```powershell
$secret = "<BOOKING_CRON_SECRET from Netlify>"
Invoke-RestMethod -Method POST -Uri "https://ceramikanero.pl/api/cron/email-dispatch" -Headers @{ Authorization = "Bearer $secret" }
```

## Notes

- Booking capacity and payments never depend on Resend availability.
- Missing Resend config or provider errors leave ledger rows as `pending`/`failed` — never `sent`.
- DNS / Resend domain verification for `ceramikanero.pl` is already done on your side.
