# Admin

## Overview

The Ceramika Nero administration area is a secure, role-based interface for
managing the public website. It lives under `/admin` and uses Supabase Auth for
session management. All access is enforced server-side; the UI is not a
security boundary.

## Authentication

- Administrators sign in with an email and password managed by Supabase Auth.
- There is no public registration. Owner accounts are bootstrapped through a
  documented safe procedure; subsequent admins are added by an owner.
- Sessions are cookie-based and refreshed by the `proxy.ts` request interceptor.
- Unauthenticated visitors to protected `/admin` routes are redirected to
  `/admin/login`.
- Password reset uses the Supabase reset flow with a fixed callback to
  `/admin/reset-password`.

## Roles and permissions

Roles are stored in the `admin_users` table, never in Supabase Auth user
metadata.

| Capability                 | Owner | Manager | Editor |
| -------------------------- | ----- | ------- | ------ |
| Manage admin users         | yes   | no      | no     |
| View audit log             | yes   | no      | no     |
| Manage site settings       | yes   | no      | no     |
| Manage redirects           | yes   | no      | no     |
| Manage workshop categories | yes   | yes     | no     |
| Manage workshops           | yes   | yes     | no     |
| Manage workshop sessions   | yes   | yes     | no     |
| Manage instructors         | yes   | yes     | no     |
| Manage pages               | yes   | yes     | yes    |
| Manage blog posts          | yes   | yes     | yes    |
| Manage gallery items       | yes   | yes     | yes    |
| Upload and manage media    | yes   | yes     | yes    |

- Owners cannot remove or deactivate the last active owner.
- Inactive administrators are denied access even if their Auth session is valid.

## Admin routes

Public (unauthenticated allowed):

- `/admin/login`
- `/admin/forgot-password`
- `/admin/reset-password`

Protected:

- `/admin` — dashboard summary
- `/admin/kategorie` — workshop categories
- `/admin/warsztaty` — workshops
- `/admin/terminy` — workshop sessions
- `/admin/rezerwacje` — workshop bookings (list/detail; empty state safe)
- `/admin/rezerwacje/nowa` — manual booking
- `/admin/zamowienia` — mixed cart orders (workshops + products)
- `/admin/produkty` — Glina Box and studio service products
- `/admin/instruktorzy` — instructors
- `/admin/strony` — content pages
- `/admin/blog` — blog posts
- `/admin/galeria` — gallery items
- `/admin/media` — media library and upload
- `/admin/ustawienia` — site settings (owner only)
- `/admin/przekierowania` — legacy redirects (owner only)
- `/admin/uzytkownicy` — admin users (owner only)
- `/admin/audyt` — audit log (owner only)

## Security model

- Server Components and Server Actions call `requireAdmin()` or role helpers on
  every privileged operation.
- RLS policies on every table restrict reads and writes to the appropriate roles.
- Audit records are append-only for normal admins; owners can view the full log.
- The secret key is server-only and never included in the client bundle.

## First owner bootstrap

1. Create the first Supabase Auth user through the Supabase dashboard or a
   trusted invitation process.
2. Copy the user's UUID from the Supabase dashboard.
3. Run a reviewed one-time SQL statement:

   ```sql
   insert into public.admin_users (user_id, role, display_name, is_active)
   values ('<UUID>', 'owner', '<Display Name>', true);
   ```

4. Never commit the UUID or password to the repository.

## Completed Phase 4 workflows

### Workshops (`/admin/warsztaty`)

- Create, edit, preview, publish, archive and restore workshops.
- Assign a category, one or more instructors and a suggested theme.
- Featured image and gallery media with roles (`gallery`, `detail`).
- SEO title/description, age range, duration, capacity, price and booking mode.
- External booking URL required only when `booking_mode = external`.
- Slug normalisation, conflict detection and reserved-route checks.
- Atomic insert/update through `upsert_workshop_with_relations`.
- Published workshops require a category, title, description and valid booking configuration.

### Sessions (`/admin/terminy`)

- Create, edit, cancel, complete, duplicate and restore sessions when safe.
- Filter list by date range, workshop, status and instructor.
- Local time input in `Europe/Warsaw`, stored as UTC `timestamptz`.
- Validation rejects non-existent DST-gap times and detects ambiguous fall-back times.
- Capacity cannot be reduced below the current `reserved_count`.
- Booking window must open before it closes and close before the session starts.

### Instructors (`/admin/instruktorzy`)

- Create, edit, activate/deactivate and reorder instructors.
- Profile image via the media picker.
- Deactivation warns when the instructor is assigned to future sessions.
- No permanent deletion; historical associations are preserved.

### Blog posts (`/admin/blog`)

- Create, edit, preview, publish, schedule, archive and restore posts.
- Excerpt, Markdown content, featured image, author and SEO metadata.
- Scheduled posts do not appear publicly before `published_at`.
- Draft and archived posts are private; previews require an active admin session and are
  `noindex`.
- Slug changes on published posts create a `legacy_redirects` entry automatically.

### Gallery (`/admin/galeria`)

- Add existing or newly uploaded media assets to the gallery.
- Edit title, description, category, display order and visibility.
- Publicly visible items require non-empty alt text from the underlying media asset.
- Duplicate media entries are rejected.

### Media picker

- Reusable picker used for workshop featured image, workshop gallery, instructor profile
  image, blog featured image and gallery items.
- Search by filename or alt text, preview dimensions and file size.
- Inline upload of new assets with alt text.
- Archived media is excluded from selection.

### Slug and redirect behaviour

- Slugs are normalised server-side: lowercase, Polish diacritics to Latin, hyphens,
  unsafe characters removed, reserved routes protected.
- When a published page, workshop or blog post slug changes, a `legacy_redirects` entry
  is created from the old public path to the new path (301), unless a redirect already
  exists. Redirect loops and chains are prevented.

## Remote migration workflow

1. Inspect pending migrations locally (`supabase/migrations/`).
2. Ensure the project reference is exactly `zorxzyvmcbwucvaywmuu`.
3. Authenticate with `npx supabase login` (or set `SUPABASE_ACCESS_TOKEN`).
4. Link: `npx supabase link --project-ref zorxzyvmcbwucvaywmuu`.
5. Inspect remote history: `npx supabase migration list`.
6. Dry-run: `npx supabase db push --dry-run`.
7. Review planned changes and stop for explicit approval before applying.
8. Apply: `npx supabase db push`.
9. Do not apply `supabase/seed.sql` to the remote project.
10. Generate types: `set SUPABASE_PROJECT_REF=zorxzyvmcbwucvaywmuu && npm run db:types`.
    - This writes generated Supabase client types to `lib/database/generated-types.ts`.
    - Custom domain types live in `lib/database/domain.ts` and are preserved by the script.
    - After the first generation, replace the manual Database type in `lib/database/types.ts`
      with an import from `lib/database/generated-types.ts` plus a re-export of
      `lib/database/domain.ts`.
11. Run integration tests against the real project using dedicated test records.

> **Note:** The current environment does not have a Supabase access token, so remote
> migration, type generation and integration tests are pending explicit user approval
> and token configuration.

## TBDs

- TBD: Customer account management and public customer registration.
- TBD: Booking management UI and related business rules.
- TBD: Responsive image variant generation pipeline.
- TBD: Admin notifications for new bookings.
