# Ceramika Nero — Deployment and Environment Setup

This document covers Netlify, Stripe, Resend and Supabase configuration required for the booking and payment system (Phase 5).

## Environment variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env` files.

### Required for production

| Variable                               | Purpose                                           | Notes                                 |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Absolute site URL for links, sitemap and webhooks | e.g. `https://ceramikanero.pl`        |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                              | Public                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key                                 | Public                                |
| `SUPABASE_SECRET_KEY`                  | Supabase service role key                         | Server-only                           |
| `STRIPE_SECRET_KEY`                    | Stripe API key                                    | Server-only, test mode by default     |
| `STRIPE_WEBHOOK_SECRET`                | Stripe webhook endpoint secret                    | Server-only                           |
| `RESEND_API_KEY`                       | Resend API key                                    | Server-only                           |
| `RESEND_FROM_EMAIL`                    | Verified sender address                           | e.g. `rezerwacje@ceramikanero.pl`     |
| `RESEND_REPLY_TO_EMAIL`                | Reply-to address                                  | e.g. `kontakt@ceramikanero.pl`        |
| `BOOKING_CRON_SECRET`                  | Secret protecting the expiry cron endpoint        | Server-only, long random string       |
| `UPSTASH_REDIS_REST_URL`               | Upstash Redis REST URL                            | Required for production rate limiting |
| `UPSTASH_REDIS_REST_TOKEN`             | Upstash Redis REST token                          | Required for production rate limiting |

### Optional

| Variable                             | Purpose                                             | Notes                            |
| ------------------------------------ | --------------------------------------------------- | -------------------------------- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Only needed if client-side Stripe Elements are used | Not required for hosted Checkout |

## Netlify configuration

1. Connect the Git repository to Netlify.
2. In **Site settings → Environment variables**, add all variables listed above.
3. Deploy Preview variables can be copied from production, but use the **Stripe test keys** and a separate Resend domain/sender unless explicitly approved for live operations.
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist` (or `.next` if using `next` adapter; check `netlify.toml` if present)
5. No DNS changes are covered by this phase.

## Stripe setup

1. Create or use a Stripe account.
2. **Develop against test mode only.** Do not switch to live keys or live webhooks without explicit approval.
3. Generate a `STRIPE_SECRET_KEY` (test) from the Stripe Dashboard.
4. Create a webhook endpoint:
   - URL: `https://<NEXT_PUBLIC_SITE_URL>/api/webhooks/stripe`
   - Events to listen to:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
   - Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.
5. Test the webhook using Stripe CLI or the Stripe Dashboard test events.
6. Do not configure live payments or live webhooks without explicit approval.

## Resend setup

1. Create a Resend account.
2. Verify the sending domain in Resend.
3. Create an API key and set `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to a verified sender address.
5. Set `RESEND_REPLY_TO_EMAIL` to the studio contact address.
6. Test transactional emails using the admin retry button or by creating a test booking in Stripe test mode.

## Email dispatch scheduler

The shared email retry endpoint is
`https://<NEXT_PUBLIC_SITE_URL>/api/cron/email-dispatch` and requires
`Authorization: Bearer <BOOKING_CRON_SECRET>`. It processes pending/failed
`booking_emails` and `order_emails`.

Also schedule expiry separately when used:
`https://<NEXT_PUBLIC_SITE_URL>/api/cron/expiry` with the same bearer secret.

## Expiry scheduler

The expiry endpoint is `https://<NEXT_PUBLIC_SITE_URL>/api/cron/expiry` and requires a `Authorization: Bearer <BOOKING_CRON_SECRET>` header.

### Option A: Netlify Scheduled Functions

If the project uses Netlify Scheduled Functions, add a scheduled function that calls the expiry endpoint with the secret. Configure the cron expression to run at least every 5 minutes.

### Option B: Supabase Cron (if available)

If the Supabase project supports `pg_cron`, create a cron job that calls the endpoint via `pg_net` or `http` extension, or use an external scheduler.

### Option C: External cron service

Any external cron service (e.g. cron-job.org, Upstash QStash, GitHub Actions) can send a periodic request to the endpoint with the bearer secret.

## Supabase

The Supabase project reference is `zorxzyvmcbwucvaywmuu`. Apply migrations only after explicit approval:

```powershell
$env:SUPABASE_ACCESS_TOKEN = '<token>'
npx supabase link --project-ref zorxzyvmcbwucvaywmuu
npx supabase db push --dry-run
# review the output, then after approval:
npx supabase db push
npx supabase db query "SELECT ..." # verify
npm run db:types
```

Migration `00000000000013_enquiries_and_order_email_types.sql` adds `enquiries`
/ `enquiry_events` and expands `order_emails.email_type`. Confirm remotely before
redeploying code that depends on those tables:

```powershell
node scripts/check-migration-13.js
npm run audit:content
```

Migration `00000000000014_order_tracking_reference.sql` adds optional
`orders.tracking_reference`. Apply in the Supabase SQL Editor when ready:

```powershell
node scripts/apply-migration-14.js
```

Code tolerates a missing column until migration 14 is applied.

After applying migrations, regenerate types when credentials allow:

```powershell
npm run db:types
```

## First owner setup

1. Create the first Auth user in the Supabase Dashboard.
2. Copy the user's UUID.
3. Provide the UUID and desired display name; the assistant will insert a single row into `public.admin_users` with `role = 'owner'`.
4. Do not create a password or hard-code an email in the codebase.

## Verification checklist after deployment

- [ ] All production environment variables are set.
- [ ] Stripe is in test mode.
- [ ] Stripe webhook endpoint is registered and receiving events.
- [ ] Resend sender domain is verified.
- [ ] Upstash Redis is configured and rate limiting is active.
- [ ] Expiry cron is scheduled and authenticated with `BOOKING_CRON_SECRET`.
- [ ] A test booking in Stripe test mode completes end-to-end.
- [ ] Cancellation within the refund window issues a full Stripe refund.
- [ ] Cancellation within 24 hours is blocked and shows the contact path.
- [ ] No secrets appear in client bundles or source control.

## Security notes

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SUPABASE_SECRET_KEY` and `BOOKING_CRON_SECRET` are server-only.
- Webhook verification uses the server-only `STRIPE_WEBHOOK_SECRET`.
- The cron endpoint rejects requests without the correct bearer secret.
- Do not deploy or modify Netlify configuration remotely without explicit approval.
- Do not configure live Stripe payments without explicit approval.
