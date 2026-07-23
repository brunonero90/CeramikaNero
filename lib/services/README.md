# Server-side services

This directory is reserved for server-side service modules (marked with the
`"server only"` import when appropriate). Examples to be added in later phases:

- `supabase/client.ts` — typed Supabase client for server components.
- `supabase/admin.ts` — service-role client for admin actions.
- `workshops.ts` — fetching and mutating workshop data.
- `bookings.ts` — booking creation and status management.
- `payments.ts` — Stripe checkout and webhook handling.
- `emails.ts` — Resend transactional email sends.

Do not create fake implementations or permanent mock repositories here.
