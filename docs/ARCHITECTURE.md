# Architecture

## Stack

- **Framework:** Next.js 16 with App Router.
- **Language:** TypeScript in strict mode.
- **Styling:** Tailwind CSS v4 for layout and utilities, CSS custom properties for
  theming.
- **Database:** Supabase (PostgreSQL) with Row Level Security.
- **Auth:** Supabase Auth (future phase).
- **Payments:** Stripe (future phase).
- **Email:** Resend (future phase).
- **Validation:** Zod for runtime validation at trust boundaries.
- **Testing:** Vitest with jsdom.
- **Deployment target:** Netlify (standalone build).

## Project structure

```
app/                          # App Router routes and boundaries
  warsztaty/                  # Public workshop routes
  dla-dzieci/                 # Category landing pages
  dla-doroslych/
  grupy-i-firmy/
components/
  layout/                     # Header, Footer, MobileNavigation, ThemeSwitch
  ui/                         # Reusable UI primitives (Button, etc.)
  workshop/                   # Workshop listing/detail components
  theme-suggestion.tsx        # Client-side category/workshop theme suggestion
lib/
  admin/
    slugs.ts                  # Slug normalisation, conflict and reserved checks
    timezones.ts              # Europe/Warsaw local-time ↔ UTC conversion
    schemas.ts                # Zod admin form schemas
  database/
    types.ts                  # Database and domain types (manual, generated-compatible)
    schema.ts                 # Zod schemas
    mappers.ts                # DB row → domain object mapping
    factory.ts                # Fixture/Supabase adapter selection
    services/                 # Supabase-backed data access
    fixtures/                 # Development fixture data and services
  supabase/
    client.ts                 # Browser client
    server.ts                 # Server Component/Server Action client
    admin.ts                  # Server-only service-role client
    environment.ts            # Environment variable validation
    fixture-mode.ts           # Fixture mode detection
  theme/                      # Theme provider, theme script, utilities
  types/                      # Domain TypeScript types
  utils/                      # Small helper utilities (money, cn)
  validation/                 # Input validation schemas (future)
supabase/
  config.toml                 # Supabase CLI configuration
  migrations/                 # Versioned SQL migrations
  seed.sql                    # Development seed data
public/                       # Static assets
```

## App Router conventions

- Route segments are created as folders with a `page.tsx`.
- Loading states use `loading.tsx` (root loader covers all routes).
- Error boundaries use `error.tsx` and `global-error.tsx`.
- The root `layout.tsx` loads fonts, injects the theme script and wraps the
  application in `ThemeProvider`.
- Public data pages use Server Components and the `services` factory.
- Public data pages export `dynamic = 'force-dynamic'` so the production build
  succeeds without real credentials; pages are rendered on demand at runtime.

## Server / client boundaries

- Layout and page components are server components by default.
- Interactive components use the `"use client"` directive.
- Theme switching, mobile navigation, error boundaries and `ThemeSuggestion` are
  client components.
- Supabase browser client is only used in client components.
- Supabase server client is only used in server components and Server Actions.
- `lib/supabase/admin.ts` is server-only and imports the service-role key.

## Theme system

- Theme tokens are stored as CSS custom properties in `app/globals.css`.
- Themes are scoped with `[data-theme="atelier"]` and `[data-theme="joyful"]`.
- An inline script in `lib/theme/theme-script.tsx` restores the user’s manual
  choice before first paint to avoid flashing.
- `ThemeProvider` exposes `setTheme` and `setSuggestedTheme`.
- `ThemeSuggestion` allows a page or category to suggest a default theme without
  overriding a visitor’s manual choice.

## Data access layer

- `lib/database/factory.ts` selects either Supabase-backed services or fixture
  services based on the environment.
- Fixtures are used automatically in development when Supabase public credentials
  are missing.
- Production never silently falls back to fixtures; missing required configuration
  causes a safe server-side failure.
- Domain-specific services are small and avoid generic repository abstractions.
- Data mapping functions in `lib/database/mappers.ts` convert DB rows (snake_case)
  to domain objects (camelCase) and validate enums with Zod.

## State management

- No global state library is required in this phase.
- Theme state is managed via React Context and `useSyncExternalStore`.
- Server state is fetched via the data access factory in Server Components.

## Security considerations

- Supabase Row Level Security restricts all public-schema tables.
- Anonymous users may only read published public content.
- Customer, booking, participant, payment and subscriber data are not readable by
  anonymous users.
- The secret key is server-only and never exposed to client bundles or
  `NEXT_PUBLIC_` variables.
- Stripe webhook endpoints must validate signatures (future phase).
- API keys are stored only in environment variables and never committed.
- Zod validation is used at trust boundaries.
- Admin access is enforced server-side by validated sessions and database roles;
  the client UI is not a security boundary.

## Environment configuration

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variable:

- `SUPABASE_SECRET_KEY`

Optional:

- `NEXT_PUBLIC_SITE_URL` — used for Open Graph and absolute links.

See `.env.example` for placeholders.

## Fixture behaviour

- Allowed in development when `NEXT_PUBLIC_SUPABASE_URL` or
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are missing.
- Never allowed in production.
- Fixture prices are provisional and must not be presented as final verified
  production data.

## Admin authentication and route protection

- Supabase Auth provides email/password sessions with cookie-based storage.
- Next.js 16 `proxy.ts` refreshes the session before each request and protects
  `/admin` routes by redirecting unauthenticated visitors to `/admin/login`.
- Server Components and Server Actions independently validate the session and
  active administrator role using the authenticated Supabase server client.
- Admin roles (`owner`, `manager`, `editor`) live in the `admin_users` table and
  are checked on every privileged operation.
- Open redirects are prevented; the login callback only redirects to a fixed
  admin path after verifying the session.

## Media and storage

- Media uploads are stored in a private `media` bucket.
- Public delivery is allowed only for intentionally public website assets.
- Original filenames are preserved in `media_assets.original_filename`; storage
  paths are generated as `originals/YYYY/MM/<uuid>/<filename>`.
- Image variants are deferred until the responsive-image architecture is decided.

## Media picker

- `app/admin/(protected)/components/media-picker.tsx` is a reusable client component
  used by workshop, instructor, blog and gallery forms.
- It accepts existing `MediaAsset[]` as a prop, keeps the uploaded-asset list derived
  from action state, and allows searching by filename or alt text.
- Inline upload is supported through the existing `uploadMediaAction` server action.
- Archived media is hidden from selection.

## Slug management

- `lib/admin/slugs.ts` provides a single server-side slug strategy: normalise Polish
  diacritics, lowercase, hyphenate, remove unsafe characters and trim.
- Reserved application routes are rejected before persistence.
- Duplicate slugs are detected per table and reported as field errors.
- Slug changes on published workshops, pages and blog posts create a `legacy_redirects`
  entry from the old public path to the new path, unless a redirect already exists.

## Timezone handling

- Session times are stored as UTC `timestamptz` in the database.
- `lib/admin/timezones.ts` uses `date-fns-tz` to convert `Europe/Warsaw` local input
  to UTC without manual offset arithmetic.
- It rejects non-existent DST-gap times and detects ambiguous fall-back times, returning
  structured errors displayed in the session form.

## Decisions to clarify (TBD)

- TBD: Caching strategy for workshop pages and time-to-live values.
- TBD: Responsive image variant generation pipeline and CDN integration.
- TBD: Whether to implement a public API or keep data access internal to
  server components and Server Actions.
- TBD: Booking submission flow and customer account creation.
- TBD: Whether to add a consent-history table for newsletter subscribers.

## Unified cart

Client cart state lives in versioned `localStorage` (`ceramika-nero-cart-v1`) with no PII. Server revalidation and `submit_cart_order` are authoritative for price, capacity and inventory. Routes: `/cart`, `/cart/checkout`, `/cart/sukces` (`noindex`). Stripe remains off; wording is order/reservation confirmation, not card payment.
