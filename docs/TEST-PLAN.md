# Test Plan

## Automated testing

### Unit tests

Tests run with **Vitest** and **jsdom**.

- Utility functions (`cn`, `formatGroszAsPln`, theme helpers, Markdown helpers,
  reserved slug helpers).
- Database mapping functions (`mapCategory`, `mapWorkshop`, `mapWorkshopSession`,
  `mapPublicSiteSettings`).
- Environment parsing (`publicEnv`, `serverEnv`).
- Fixture mode detection (`isFixtureMode`, `assertNotFixtureModeInProduction`).
- Adapter selection (`getAdapterName`).
- Redirect validation (`legacyRedirectSchema`, `detectRedirectLoop`).
- Suggested theme resolution (`resolveSuggestedTheme`).
- Fixture data correctness (public filtering, slug lookup, sessions).
- Media filename sanitisation and storage path generation.
- Markdown rendering and sanitisation.
- Slug generation with Polish characters and reserved-slug rejection.
- Europe/Warsaw timezone conversion, DST invalid-time rejection and ambiguous-time
  detection.
- Workshop, session, instructor, blog post and gallery item validation schemas.

### Integration tests

- Theme persistence and hydration behaviour.
- Booking state helpers, price helpers, Warsaw time helpers and booking schemas.
- Server Actions and database interactions against the real Supabase project using
  dedicated, clearly prefixed test records. Cover: public reads, public denial of
  private tables, admin login, non-admin denial, role boundaries (editor/manager/owner),
  workshop CRUD and multi-table relations, session creation and timezone handling,
  capacity constraints, instructor lifecycle, blog draft/publish/schedule, gallery
  ordering and visibility, media metadata, audit records, slug conflicts and
  redirect creation after slug changes.
- Phase 5 booking integration (against the real project after migration approval):
  atomic booking and participant creation, concurrent booking attempts,
  expiry and capacity release, idempotent payment confirmation, duplicate webhooks,
  late payment after expiry, cancellation and capacity release, full and partial
  refunds, manual bookings, editor denial, manager access, public denial of
  private booking rows, secure booking status lookup, cancellation-token validation.
  Cleanup only the records created by the test run.

### End-to-end tests

End-to-end browser testing is not implemented in this phase.

## Accessibility testing

- Keyboard navigation through header, mobile menu and theme switch.
- ARIA attributes and landmark regions.
- Color contrast checks for both themes.
- Screen reader flow for booking and navigation.
- `prefers-reduced-motion` disables animations.
- Polish `lang="pl"` is set on the document.

## Visual regression

- Compare homepage in Atelier and Joyful modes.
- Compare mobile navigation at common widths.
- Check for layout shifts when fonts load.

## Manual checklist for Phase 2

- [ ] `/warsztaty` lists all published workshops.
- [ ] `/warsztaty/{slug}` shows workshop details, sessions and enquiry action.
- [ ] `/dla-dzieci`, `/dla-doroslych`, `/grupy-i-firmy` filter by category.
- [ ] Category suggested themes apply only when no manual theme is chosen.
- [ ] Manual theme choice persists across navigation.
- [ ] Loading state is visible when navigating slowly.
- [ ] Empty state is shown for categories with no workshops.
- [ ] Error boundaries catch unexpected data errors.
- [ ] Mobile layout is responsive and usable.
- [ ] All interactive elements are keyboard-navigable.
- [ ] Production build completes without errors.
- [ ] Secret key is not present in any client bundle.
- [ ] Production does not silently fall back to fixtures.
- [ ] No private tables or customer fields are exposed in public pages.

## Manual checklist for Phase 3

- [ ] `/admin` redirects unauthenticated users to `/admin/login`.
- [ ] Login with a non-admin or inactive account is rejected safely.
- [ ] Logout clears the session and redirects to login.
- [ ] Admin sidebar and mobile navigation are usable.
- [ ] Role restrictions are enforced by Server Actions, not just UI.
- [ ] Categories, pages, settings, redirects and admin users can be edited by
      permitted roles.
- [ ] Media upload validates type, size and requires alt text.
- [ ] Audit records are created for significant actions.
- [ ] `/blog`, `/blog/{slug}`, `/galeria` and `/{slug}` render public content.
- [ ] Draft and archived content is hidden publicly unless an admin is in preview mode.
- [ ] Preview URLs use `noindex` and require an active admin session.
- [ ] Reserved slugs cannot be used for dynamic content pages.
- [ ] Markdown output is sanitised and cannot execute scripts.
- [ ] The last active owner cannot be deactivated.

## Manual checklist for Phase 4

- [ ] Workshops, sessions, instructors, blog and gallery list pages filter and paginate
      server-side.
- [ ] Workshop forms create and update a workshop atomically with instructors and
      gallery media.
- [ ] Session forms convert Europe/Warsaw local time to UTC and reject DST-gap times.
- [ ] Blog posts can be scheduled, drafted, published, archived and restored.
- [ ] Gallery items require alt text before they can be made visible.
- [ ] Media picker can select existing assets and upload new ones inline.
- [ ] Slug changes on published workshops, pages and blog posts create redirects.
- [ ] Sidebar navigation hides workshop/session/instructor links from editors.
- [ ] Public pages respect scheduled publication times, archived status and previews.
- [ ] Audit records are written for all completed CRUD operations.
- [ ] Remote migrations were reviewed and applied only after explicit approval.
- [ ] Real Supabase types were generated and manual types were replaced.
- [ ] Integration tests against the real project pass and clean up their records.

## Manual checklist for Phase 5

- [ ] `/warsztaty/{slug}/rezerwacja` shows only upcoming, bookable sessions with capacity.
- [ ] Public booking form validates quantity, participant ages and terms acceptance.
- [ ] Successful booking creates a Stripe Checkout session and redirects the customer.
- [ ] Stripe webhook confirms the booking and sends a confirmation email.
- [ ] The success page is presentation-only and does not mark the booking paid itself.
- [ ] Expired bookings release capacity exactly once.
- [ ] Customer cancellation link works and respects the 24-hour refund window.
- [ ] Staff can cancel, refund, move and retry emails from `/admin/rezerwacje/[id]`.
- [ ] Editors cannot access the bookings section.
- [ ] Manual bookings reserve capacity and support cash, transfer, terminal, complimentary.
- [ ] No booking, payment or customer data is exposed on public pages.
- [ ] Rate limiting is active in production (Upstash Redis configured).
- [ ] The expiry cron endpoint is protected by `BOOKING_CRON_SECRET`.
- [ ] Stripe is in test mode and the webhook is configured.
- [ ] Resend sender domain is verified and emails are delivered.
- [ ] No secrets appear in client bundles or logs.

## Tools

- Vitest for unit tests.
- ESLint and TypeScript for static analysis.
- Prettier for formatting.
- Lighthouse and axe-core for accessibility checks.
- Playwright for end-to-end tests (future phase).

## Validation commands

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

## Decisions to clarify (TBD)

- TBD: Whether to set up a continuous integration runner before deployment.
- TBD: Which browsers and devices must be explicitly supported.
- TBD: Whether visual regression testing is required from the first release.
- TBD: Availability of Stripe test credentials for end-to-end payment tests.
- TBD: Integration tests against the real Supabase project require explicit approval
  and a securely configured secret key. They are not run in ordinary public CI.
