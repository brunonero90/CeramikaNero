# Email activation (Resend) — Ceramika Nero

Transactional booking emails are implemented in the app (`booking_emails` ledger + Resend transport + Netlify retry worker). Delivery stays off until Resend credentials and a verified sending domain are configured.

## What the app already does

After a successful booking (independent of email):

1. Creates one customer confirmation ledger job (`confirmation`)
2. Creates one administrator notification ledger job (`admin_notification`) when `BOOKING_ADMIN_EMAIL` is set
3. Tries to send immediately via Resend when configured
4. Leaves failed/pending rows retryable via `/api/cron/email-dispatch` (Netlify schedule every 5 minutes)
5. Idempotent booking retries do not send a second confirmation once status is `sent`

## Minimum steps for Bruno

1. Create or sign in to [Resend](https://resend.com).
2. Add the real Ceramika Nero sending domain (for example `ceramikanero.pl` or the domain you will use in production mail).
3. Add the **exact DNS records Resend shows for your account/domain** (SPF / DKIM / optionally DMARC). Do not invent values — Resend generates them per domain.
4. Wait until the domain status is **Verified** in Resend.
5. Create a restricted production API key in Resend.
6. In Netlify → Site `ceramikanero` → Environment variables (Production), set:
   - `RESEND_API_KEY` = the production API key
   - `RESEND_FROM_EMAIL` = a verified sender on that domain (example shape: `rezerwacje@your-verified-domain`)
   - `RESEND_REPLY_TO_EMAIL` = studio contact (`nerogosia@gmail.com` unless you prefer a domain mailbox)
   - `BOOKING_ADMIN_EMAIL` = administrator inbox that should receive new-booking alerts
   - Confirm `NEXT_PUBLIC_SITE_URL` = `https://ceramikanero.netlify.app` (or the final custom domain)
   - Confirm `BOOKING_CRON_SECRET` is set (already used by expiry cron)
7. Redeploy Netlify after saving variables (or trigger a clear cache rebuild).
8. Run a controlled smoke booking to a **test address you control** (never a real customer).
9. Confirm:
   - customer confirmation arrives
   - admin notification arrives
   - `booking_emails` rows show `status = sent` with a provider message id
   - repeating the same booking idempotency key does **not** create another send

## Controlled smoke test

```powershell
# After Resend vars are live on Netlify:
# 1) Book once via the public form using a personal test email
# 2) Confirm ledger + inbox
# 3) Cancel/archive the smoke booking in /admin/rezerwacje
```

Optional worker poke (uses the existing cron secret; do not expose it publicly):

```powershell
$secret = "<BOOKING_CRON_SECRET from Netlify>"
Invoke-RestMethod -Method POST -Uri "https://ceramikanero.netlify.app/api/cron/email-dispatch" -Headers @{ Authorization = "Bearer $secret" }
```

## Notes

- Booking capacity and payments must never depend on Resend availability.
- Provider secrets stay server-only (`RESEND_API_KEY` is never `NEXT_PUBLIC_*`).
- DNS record values are account-specific; copy them from the Resend dashboard only.
