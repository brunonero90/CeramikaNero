# Ceramika Nero

A complete replacement for [https://www.ceramikanero.com/](https://www.ceramikanero.com/)
built with Next.js, TypeScript and Tailwind CSS. Designed for Ceramika Nero, a
ceramics and art studio in Suchy Las, Poland.

This is a production project. It will replace Wix and be deployed on Netlify.

## Phase 1

The codebase establishes the technical foundation, project documentation and a
working theme system with two visual modes:

- **Atelier** — elegant, warm and artisanal
- **Joyful** — creative, colourful and family-friendly

## Phase 2

Phase 2 adds the production-ready Supabase data foundation:

- Versioned SQL migrations and seed data under `supabase/`.
- Manual TypeScript database types in `lib/database/types.ts` (generated-compatible) with
  custom domain types extracted to `lib/database/domain.ts` so they are preserved after
  `npm run db:types`.
- Browser, server and server-only Supabase clients under `lib/supabase/`.
- Domain-specific data services with Supabase and fixture implementations.
- Public routes: `/warsztaty`, `/warsztaty/[slug]`, `/dla-dzieci`, `/dla-doroslych`,
  `/grupy-i-firmy`, plus supporting content pages.
- Development fixture fallback when Supabase is not configured.
- Environment validation and fixture safety checks.
- Unit tests with Vitest for the data layer, money, themes and redirects.
- Updated documentation in `/docs`.

No authentication, online payments, booking submission, email sending or admin
interface is implemented in this phase.

## Phase 3

Phase 3 implements the secure administration foundation:

- Supabase Auth email/password login for administrators.
- Role-based access control (`owner`, `manager`, `editor`) backed by the database.
- Next.js 16 `proxy.ts` request interception for session refresh and admin-route
  protection.
- Full CRUD for categories, content pages, site settings, redirects and admin users.
- Server Actions with session validation, role checks, Zod validation and audit logging.
- Supabase Storage media uploads with safe paths, MIME validation and metadata capture.
- Public routes for `/blog`, `/blog/[slug]`, `/galeria` and dynamic content pages.
- Admin preview for unpublished content, blocked from public indexing.
- Placeholder list pages for workshops, sessions, instructors, blog and gallery (completed
  in Phase 4).

## Phase 4

Phase 4 completes the administration system and prepares it for operational use:

- Full CRUD for workshops, sessions, instructors, blog posts and gallery items.
- Reusable media picker integrated into workshop, instructor, blog and gallery forms.
- Server-side slug management with Polish normalisation, reserved-route checks, conflict
  detection and automatic `legacy_redirects` creation on slug changes.
- Europe/Warsaw local-time input for sessions with DST-safe conversion to UTC.
- Blog scheduling, draft previews and lifecycle controls (publish, archive, restore).
- Role-based sidebar filtering for `owner`, `manager` and `editor`.
- Server-side search, filters, pagination and sorting on all admin list pages.
- Atomic workshop writes through `upsert_workshop_with_relations` database function.
- Updated public blog filtering to respect scheduled publication times.
- Migration review and remote deployment workflow documented in `docs/ADMIN.md`.

Remote migration, type generation and integration tests require explicit user approval and a
Supabase access token (see `docs/ADMIN.md`).

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — start the production server
- `npm run lint` — run ESLint
- `npm run format` — format files with Prettier
- `npm run format:check` — check formatting without writing
- `npm run typecheck` — run TypeScript without emitting
- `npm run test` — run unit tests with Vitest
- `npm run test:watch` — run unit tests in watch mode
- `npm run db:types` — generate `lib/database/generated-types.ts` from the linked Supabase project
  (domain types in `lib/database/domain.ts` are preserved)

## Environment

Copy `.env.example` to `.env.local` and fill in the values:

- `NEXT_PUBLIC_SUPABASE_URL` — public Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public Supabase publishable key (safe for the browser)
- `SUPABASE_SECRET_KEY` — server-only Supabase secret key (never expose to the client or commit)

If Supabase public credentials are missing in development, the application uses
fixture data automatically. Production never silently falls back to fixtures.

## Documentation

Project documentation lives in `/docs`:

- `PRODUCT.md`
- `ARCHITECTURE.md`
- `DESIGN-SYSTEM.md`
- `DATABASE.md`
- `BOOKING-RULES.md`
- `PAYMENT-FLOWS.md`
- `ADMIN.md`
- `WIX-MIGRATION.md`
- `SEO-MIGRATION.md`
- `TEST-PLAN.md`
