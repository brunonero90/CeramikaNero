# Ceramika Nero — Success Master Plan

**Purpose:** Single source of truth for making this site the best ceramics-studio booking website in its class — and for running long Cursor sessions until every critical flow works.

**Audience:** Bruno + Cursor agents  
**Primary language of the product:** Polish  
**Studio:** Ceramika Nero, Suchy Las  
**Replacement target:** Wix site → Next.js + Supabase + Netlify

**Last updated:** 2026-07-25

---

## 0. How to use this document with Cursor (all-day mode)

### Operating rules for long sessions

1. **One mission per chat / loop**, but always reopen this file and tick items as you go.
2. **Never invent business facts** (prices, ages, capacities, schedules, FAQ answers, instructor bios) without Bruno confirmation. Prefer draft + admin completion over guessing.
3. **Bruno owns git push and Netlify deploy** unless he explicitly hands them back.
4. **Production DB mutations** need explicit approval (except when Bruno already authorized a named seed/import).
5. Keep a running scratchpad in `tmp/overnight-completion/` (status, smoke reports, decision log). Do not clutter `docs/` with ephemeral notes.
6. After every deploy: run the **Smoke ladder** (section 12) before calling anything “done”.
7. Prefer small, reviewable commits over mega-diffs. Group by: deploy blockers → booking catalog → admin auth → integrations → polish/SEO → excellence.

### Suggested all-day Cursor agenda (repeatable)

| Block | Focus                                         | Exit criteria                                                            |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------ |
| A     | Unblock production deploy + admin login       | Site builds on Netlify; `/admin` reachable after login                   |
| B     | Import workshops + publish real terminy       | Every public “Rezerwacja” CTA lands on a bookable form with ≥1 slot      |
| C     | End-to-end booking (guest)                    | Bank-transfer booking creates capacity hold; success page; admin sees it |
| D     | Wire cron, email, payments                    | Expiry runs; Resend sends; Stripe test path optional                     |
| E     | Redirect archive shells → first-party booking | No dead `/booking-calendar/*` CTAs for live offers                       |
| F     | Content fidelity + CMS                        | Priority routes look like the brand; FAQ/legal clean                     |
| G     | Hardening + analytics + SEO cutover           | Search Console, redirects, monitoring, DNS plan                          |
| H     | Excellence layer                              | Best-in-class UX that Wix never had                                      |

### Prompt starter (paste into a new Cursor chat)

```text
Read docs/SUCCESS-MASTER-PLAN.md and tmp/overnight-completion/GO-LIVE-STATUS.md.
Work the highest open P0 items first. Do not invent prices or schedules.
Bruno handles push/deploy unless he says otherwise.
Report blockers with exact URLs and reproduction steps.
```

---

## 1. Current reality (honest baseline)

### What already exists in code

- Next.js 16 site with Atelier / Joyful themes
- Supabase schema + booking RPCs (`begin_booking`, expiry, refunds, etc.)
- Public calendar + booking form + success / cancel / payment routes
- Full admin CRUD (warsztaty, terminy, rezerwacje, blog, galeria, media, …)
- Bank-transfer fallback when Stripe is not configured
- Local booking mode for safe offline development (`BOOKING_LOCAL_MODE`)
- Clone/archive pages for Wix visual continuity

### What is broken or incomplete right now (reported + known)

| Symptom                                                   | Likely cause                                                                                                                                                                                         | Priority              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Rezerwacja → 404**                                      | Almost no published workshops/sessions in production DB (only smoke-test historically). CTAs point at slugs/sessions that do not exist. Archive shells (`/booking-calendar/*`) are not live booking. | **P0**                |
| **Admin login: credentials accepted, then nothing**       | Soft client navigation after Server Action was hanging; hard `window.location.assign` fix may still be **undeployed**. Cookie / proxy / Netlify session issues possible if deploy is stale.          | **P0**                |
| **Netlify deploy: `___netlify-server-handler` too large** | File tracing pulled huge `reference/` (and/or standalone output). Bundle-size fixes may still be **uncommitted / undeployed**.                                                                       | **P0**                |
| Empty `/kalendarz`                                        | No published future `workshop_sessions`                                                                                                                                                              | **P0**                |
| No real customer emails                                   | Resend not configured                                                                                                                                                                                | **P1**                |
| No card payments                                          | Stripe not configured (bank transfer works)                                                                                                                                                          | **P1**                |
| Pending holds may never expire                            | `/api/cron/expiry` exists but **no schedule wired**                                                                                                                                                  | **P1**                |
| Homepage “rezerwacja” cards → archive shells              | Landings still link `/booking-calendar/...` instead of `/warsztaty/{slug}/rezerwacja`                                                                                                                | **P1**                |
| Visual fidelity incomplete                                | Clone QA not fully passed on priority routes                                                                                                                                                         | **P2**                |
| FAQ polluted / archive                                    | Do not invent FAQ; need clean CMS content                                                                                                                                                            | **P2**                |
| Shop / cart / vouchers                                    | **Decision made:** limited unified cart for workshop sessions + Glina Box (payment later). No general marketplace/vouchers.                                                                          | **P0** (implementing) |
| PRODUCT.md non-goals stale                                | Historical; ignore for planning                                                                                                                                                                      | —                     |

### Critical product truth

> **Booking only works when the database has published workshops + future published sessions.**  
> Pretty pages without rows = 404 / empty calendar. Importing “what’s on the pages” into Supabase is not optional — it is the product.

---

## 2. Definition of success (this class of website)

A ceramics studio site in this class wins when:

1. A parent on a phone can book a kids workshop in under 2 minutes without calling.
2. An adult can pick a Friday evening “Glina do wina” slot and get clear payment + confirmation.
3. Gosia (owner) can see today’s bookings, mark bank transfers paid, move people between sessions, and cancel with refunds — without developer help.
4. Marketing pages (dzieci / dorosłych / panieńskie / firmy / urodziny) convert into **real bookable offers**, not dead Wix leftovers.
5. The site feels like a warm studio in Suchy Las — not a generic SaaS template and not a broken Wix clone.
6. Search and social links from the old domain never 404 after Shopify/Wix cutover.
7. Trust is explicit: clear price, place, age rules, cancellation, privacy, and “what happens after I pay / transfer”.

**“Best in class” bar (beyond parity with old Wix):**

- Instant capacity truth (no double-booking)
- Beautiful calendar + workshop discovery
- Bulletproof mobile booking
- Polish transactional emails that feel human
- Admin that is faster than Wix dashboards
- Theme modes that actually delight (Atelier / Joyful)
- Enquiry path for private events that does not fake calendar slots
- Measurable conversion funnel (view → slot → form → paid/awaiting)

---

## 3. P0 — Must fix before calling the site usable

### 3.1 Deploy unblockers

- [ ] Confirm Netlify build succeeds (server handler under size limits)
- [ ] Confirm production env: Supabase URL + publishable + secret, `NEXT_PUBLIC_SITE_URL`, `BOOKING_CRON_SECRET`
- [ ] Confirm `BOOKING_LOCAL_MODE` and `FIDELITY_FIXTURES` are empty/off on Netlify
- [ ] Rotate secrets that were printed by CLI historically (`SUPABASE_SECRET_KEY`, `BOOKING_CRON_SECRET`)
- [ ] Push all auth + bundle-size fixes that currently exist only locally
- [ ] Post-deploy: open production URL, not only localhost

### 3.2 Admin login must work end-to-end

**User report:** email + password accepted → “Zalogowano / Przekierowanie…” → stuck.

Checklist:

- [ ] Deploy login hard-navigation fix (`window.location.assign('/admin')`)
- [ ] Verify `admin_users` row exists, `is_active = true`, role set
- [ ] Verify Supabase Auth user email matches admin row `user_id`
- [ ] On production: login → lands on `/admin` pulpit (not bounce to login)
- [ ] Refresh `/admin` still authenticated
- [ ] Logout → `/admin/login`
- [ ] Forgot-password email path (needs Resend or Supabase email config)
- [ ] Reset-password completes and allows login
- [ ] Role checks: editor cannot open owner-only screens
- [ ] Audit log records login/logout
- [ ] If still stuck: capture Network tab (Set-Cookie on login action, document request to `/admin`, any 307/401)

### 3.3 Rezerwacja must stop 404-ing

For **every** live offer that customers should book:

1. Workshop row in `workshops` — `status = published`, sensible `booking_mode`
2. At least one future `workshop_sessions` row — published/scheduled, capacity > 0
3. Public CTA points to `/warsztaty/{slug}/rezerwacja` (optionally `?session={id}`), **not** only `/booking-calendar/...`
4. `/termin/{id}` resolves for that session
5. `/kalendarz` lists it

**Immediate investigation list (do in order):**

- [ ] Reproduce exact 404 URL(s) Bruno hits (write them down)
- [ ] Check whether slug exists in Supabase
- [ ] Check `booking_mode` (`scheduled` required for form; `enquiry` should go to contact, not fake checkout)
- [ ] Check sessions for that workshop (dates in the future, not cancelled)
- [ ] Fix CTA source if page still links archive shell
- [ ] Smoke a booking; confirm capacity increments

### 3.4 Catalog import into DB (mandatory)

**Goal:** Everything customers can currently click as a workshop/rezerwacja on the site must be bookable from Supabase.

Source of candidates (already in repo, not auto-applied):

- `lib/clone/content/workshop-catalog-import.ts`
- Archive homepage / landing cards
- Fixture mirrors in `lib/database/fixtures/data.ts` / `supabase/seed.sql` (dev-oriented — treat prices as provisional)

**Known catalog candidates (verify before publish):**

| Slug                                       | Title                  | Suggested mode                  | Notes                      |
| ------------------------------------------ | ---------------------- | ------------------------------- | -------------------------- |
| `ceramika-dla-doroslych`                   | Ceramika dla dorosłych | scheduled                       | Needs terminy              |
| `glina-do-wina`                            | Glina do wina          | scheduled                       | Needs terminy              |
| `kurs-rysunku-malarstwa-ceramiki-6-10-lat` | Kurs 6–10 lat          | scheduled / confirm             | Ages                       |
| `kurs-ceramiki-dla-mlodziezy-11`           | Kurs młodzież 11+      | scheduled / confirm             | Ages                       |
| `glina-i-rodzina`                          | Glina i rodzina        | scheduled                       | Family                     |
| `urodziny-ceramiczne`                      | Urodziny ceramiczne    | enquiry _or_ scheduled packages | Often quote-based — decide |
| `warsztaty-dla-firm`                       | Warsztaty dla firm     | enquiry                         | Corporate quote            |
| `wieczory-panienskie`                      | Wieczory panieńskie    | enquiry _or_ scheduled          | Decide                     |

Import workflow (recommended):

1. [ ] Upsert categories used by catalog
2. [ ] Upsert instructor(s) (e.g. Małgorzata Nero)
3. [ ] Upsert workshops — start as **draft** if price/capacity unconfirmed
4. [ ] Bruno confirms price, capacity, duration, age rules per workshop
5. [ ] Publish workshops that are ready
6. [ ] Create a **real schedule** of future sessions in `/admin/terminy` (or scripted seed with Bruno-approved dates)
7. [ ] Point all public CTAs at first-party routes
8. [ ] Remove or hide smoke-test workshop from public calendar after real data exists
9. [ ] Verify each slug: detail → rezerwacja → submit → admin list

**Hard rule:** Do not publish fake dates as if they were real studio schedule. If Bruno has not approved a calendar, create a short “open booking window” of confirmed dates only.

### 3.5 Guest booking happy path (bank transfer)

- [ ] Select session from `/kalendarz`
- [ ] Open `/termin/[id]`
- [ ] Continue to `/warsztaty/[slug]/rezerwacja`
- [ ] Fill purchaser + participants (incl. child ages where required)
- [ ] Accept terms / privacy
- [ ] Submit → success page with booking reference
- [ ] Capacity reserved in DB
- [ ] Idempotent retry does not double-book
- [ ] Admin sees booking under `/admin/rezerwacje`
- [ ] Anon cannot read others’ bookings (RLS)
- [ ] Honeypot / rate-limit do not block real customers

---

## 4. Complete flow matrix (everything that must work)

Mark each: ❌ broken · 🟡 partial · ✅ verified on production

### 4.1 Discovery & marketing

| Flow                                     | Routes                                            | Done? |
| ---------------------------------------- | ------------------------------------------------- | ----- |
| Homepage loads, brand-first, both themes | `/`                                               |       |
| Theme toggle persists                    | header                                            |       |
| Warsztaty listing from DB                | `/warsztaty`                                      |       |
| Category landings                        | `/dla-dzieci`, `/dla-doroslych`, `/grupy-i-firmy` |       |
| Offer landings                           | `/glinadowina`, `/panienskie`, `/urodziny`, …     |       |
| Workshop detail                          | `/warsztaty/[slug]`                               |       |
| Gallery                                  | `/galeria`                                        |       |
| Blog index + post + category             | `/blog`, `/blog/[slug]`, `/blog/categories/...`   |       |
| Kontakt                                  | `/kontakt`                                        |       |
| Legal                                    | `/regulamin`, `/polityka-prywatnosci`             |       |
| FAQ (clean content)                      | `/faq`                                            |       |
| Mobile nav “Zarezerwuj”                  | → useful destination                              |       |

### 4.2 Booking & payments

| Flow                                    | Routes / systems                           | Done? |
| --------------------------------------- | ------------------------------------------ | ----- |
| Public calendar                         | `/kalendarz`                               |       |
| Session detail                          | `/termin/[id]`                             |       |
| Multi-step reservation form             | `/warsztaty/[slug]/rezerwacja`             |       |
| Bank-transfer confirmation instructions | `/rezerwacja/sukces?payment=bank_transfer` |       |
| Stripe Checkout (when keys present)     | checkout → webhook → confirm               |       |
| Payment return success                  | `/rezerwacja/sukces`                       |       |
| Payment abandoned                       | `/rezerwacja/anulowana`                    |       |
| Resume payment link                     | `/rezerwacja/[reference]/platnosc`         |       |
| Customer cancel via email token         | `/rezerwacja/anulowanie`                   |       |
| Pending hold expiry cron                | `/api/cron/expiry` + schedule              |       |
| Sold-out session UX                     | clear, no 500                              |       |
| Enquiry workshops                       | CTA → `/kontakt` with context              |       |
| External booking URL workshops          | open external, no fake form                |       |
| Double-submit / refresh safety          | idempotency key                            |       |

### 4.3 Email & notifications

| Flow                                           | Done? |
| ---------------------------------------------- | ----- |
| Booking confirmation (customer)                |       |
| Payment awaiting / bank instructions           |       |
| Payment received                               |       |
| Cancellation confirmation                      |       |
| Session reminder (nice-to-have → excellence)   |       |
| Admin notification on new booking (excellence) |       |
| `booking_emails` ledger always written         |       |
| Resend domain authenticated (SPF/DKIM)         |       |

### 4.4 Admin operations

| Flow                                      | Done? |
| ----------------------------------------- | ----- |
| Login / logout / session refresh          |       |
| Pulpit counts sensible                    |       |
| CRUD warsztaty + publish/archive          |       |
| CRUD terminy (Warsaw time, DST-safe)      |       |
| CRUD rezerwacje + detail actions          |       |
| Manual / offline booking                  |       |
| Mark bank transfer paid / confirm         |       |
| Cancel + refund (Stripe) / cancel offline |       |
| Move booking to another session           |       |
| Instructors CRUD                          |       |
| Categories CRUD                           |       |
| Blog lifecycle (draft/schedule/publish)   |       |
| Gallery visibility                        |       |
| Media upload + picker                     |       |
| CMS pages                                 |       |
| Redirects                                 |       |
| Site settings                             |       |
| Admin users + roles                       |       |
| Audit log readable                        |       |
| Preview unpublished content (noindex)     |       |

### 4.5 Platform / security / ops

| Flow                                           | Done? |
| ---------------------------------------------- | ----- |
| Netlify production deploy green                |       |
| Supabase backups / point-in-time understanding |       |
| RLS verified for bookings, admin, media        |       |
| Webhook signature verification                 |       |
| Cron secret required                           |       |
| Rate limiting (Upstash) in production          |       |
| Error monitoring (Sentry or similar)           |       |
| Uptime check on `/` and `/kalendarz`           |       |
| Secrets not in git; rotated after leaks        |       |

### 4.6 Migration & SEO cutover

| Flow                                            | Done? |
| ----------------------------------------------- | ----- |
| Inventory of old Wix URLs                       |       |
| `legacy_redirects` for changed slugs            |       |
| Priority 301s for top traffic pages             |       |
| Canonical + sitemap + robots                    |       |
| Open Graph / social previews                    |       |
| DNS cutover plan (`ceramikanero.com` → Netlify) |       |
| Post-cutover 404 crawl                          |       |
| Google Business Profile link update             |       |
| Facebook / Instagram link update                |       |

---

## 5. Data that must exist for “what’s on the pages” to book

### 5.1 Minimum viable production dataset

- [ ] Categories matching navigation (dzieci, dorosłych, glina do wina, firmy, …)
- [ ] At least one active instructor
- [ ] All bookable workshops from public CTAs
- [ ] Site settings (contact email, phone, address, booking copy)
- [ ] Privacy / terms version strings used by booking consent fields
- [ ] **Future sessions** covering the next 2–8 weeks for each scheduled workshop
- [ ] Clear enquiry workshops without fake sessions

### 5.2 Session quality checklist (per termin)

- [ ] Correct workshop link
- [ ] `starts_at` / `ends_at` in real studio hours
- [ ] Timezone `Europe/Warsaw`
- [ ] Capacity matches room reality
- [ ] Price gross grosz matches public promise
- [ ] Location name/address (Suchy Las studio)
- [ ] Status `scheduled` (or `sold_out` when full)
- [ ] Booking open/close windows if used
- [ ] Not accidentally left as draft

### 5.3 Cleanup

- [ ] Remove smoke-test workshop/session/bookings after real catalog works
- [ ] No `[TEST]` / `[SMOKE-TEST]` visible to customers
- [ ] No fixture-only prices silently published as truth

---

## 6. CTA / URL consistency (stop sending people to ghosts)

Every “Rezerwacja” / “Zarezerwuj” control on the site should resolve to one of:

1. **Scheduled workshop** → `/warsztaty/{slug}/rezerwacja` (+ session when known)
2. **Enquiry / private** → `/kontakt` (prefilled subject if possible)
3. **External** → verified external URL
4. **Never** a 404 archive shell presented as checkout

Audit surfaces:

- [ ] Homepage service cards / landings
- [ ] `/dla-dzieci`, `/dla-doroslych`, `/grupy-i-firmy`
- [ ] `/glinadowina`, `/panienskie`, `/urodziny`, related copy pages
- [ ] `/booking-calendar/[slug]` — remap or redirect
- [ ] `/service-page/*`, `/courses/*`, webinar leftovers — decide keep/redirect/remove
- [ ] Mobile sticky / FAB actions
- [ ] Blog posts that promise booking links
- [ ] Footer / header nav

---

## 7. Integrations roadmap

### Must-have for “real studio operations”

| Integration    | Why                           | Status target                                 |
| -------------- | ----------------------------- | --------------------------------------------- |
| Supabase       | Source of truth               | Production linked                             |
| Resend         | Confirmations customers trust | Configure + verify domain                     |
| Scheduled cron | Release unpaid holds          | Netlify scheduled function / QStash / pg_cron |
| Upstash Redis  | Abuse protection on booking   | Configure                                     |

### Should-have soon

| Integration                               | Why                                |
| ----------------------------------------- | ---------------------------------- |
| Stripe (test → live)                      | Card checkout for impulse bookings |
| Error monitoring                          | Know when booking breaks at 22:00  |
| Analytics (Plausible/GA4 — privacy-aware) | See which workshops convert        |
| Meta pixel optional                       | Only if Bruno wants ads            |

### Explicit non-goals unless decided

- Full ecommerce shop / stocked products
- Customer accounts / “my bookings” login (PRODUCT mentioned; not required for launch)
- Multi-language English site (nice later)
- Memberships / subscriptions
- AI chatbot

---

## 8. Content & brand excellence (best in class)

### 8.1 Visual & UX

- [ ] Priority routes pass visual fidelity vs archive (without pixel-slavery)
- [ ] Brand wins the first viewport (not generic AI cream/terracotta clichés unless true to brand)
- [ ] Photography of real studio work dominates marketing sections
- [ ] Calendar is delightful on mobile (biggest conversion surface)
- [ ] Booking form feels short: progress, validation in Polish, no dead ends
- [ ] Sold-out and waitlist messaging (waitlist = excellence stretch)
- [ ] Accessibility: focus states, contrast, form labels, keyboard
- [ ] Performance: LCP on homepage/kalendarz, optimized images
- [ ] Both themes tested on key flows (not only Atelier)

### 8.2 Trust & studio specifics (Suchy Las)

- [ ] Clear address, map/parking note, phone, email everywhere it matters
- [ ] What to bring / apron / clothing note on workshop detail
- [ ] Age rules obvious before payment
- [ ] Alcohol workshops (Glina do wina) — age 18 messaging
- [ ] Birthday / panieński / firmy — clear “zapytaj o termin” vs instant book
- [ ] Cancellation policy readable before submit
- [ ] Bank transfer details correct and consistent
- [ ] Photo consent / GDPR tied to real policy pages

### 8.3 Content systems

- [ ] Import or rewrite FAQ properly (no polluted archive dump)
- [ ] Blog: at least a few published posts with real images
- [ ] Gallery curated (visible items, good alts)
- [ ] CMS pages for kontakt / oferta static copy where needed
- [ ] Legal pages professional; remove stale “sklep Wix” claims if shop is not live
- [x] Cart decision: limited unified cart for workshops + Glina Box; Stripe later; no vouchers marketplace

### 8.4 Differentiation vs typical studio sites

- [ ] Smart recommendations (“podobne warsztaty”)
- [ ] “Najbliższy termin” badge on workshop cards
- [ ] ICS/add-to-calendar on success page
- [ ] Shareable workshop links with OG image of clay/studio
- [ ] Admin “dzisiejsze zajęcia” view
- [ ] SMS reminder optional later (Polish providers)
- [ ] Gift voucher as first-class booking credit (if Bruno wants — currently archive-only)
- [ ] Corporate enquiry form with headcount + preferred dates (structured, not only free email)

---

## 9. Testing ladder (do not skip)

### 9.1 Automated

- [ ] `npm run typecheck`
- [ ] `npm run test` (unit)
- [ ] Booking/idempotency tests still green
- [ ] Admin auth contract tests green
- [ ] Optional: `scripts/e2e-local-booking.js` under local mode
- [ ] Optional: Playwright happy path against preview deploy

### 9.2 Manual production smoke (every deploy)

1. `/` loads, theme toggle works
2. `/admin/login` → pulpit
3. `/warsztaty` shows real workshops
4. `/kalendarz` shows real future sessions
5. Book 1 seat bank-transfer → reference shown
6. Admin opens that booking
7. Cancel path or mark paid (as designed)
8. Mobile (real phone): full booking
9. Logout / login again

### 9.3 Regression watchlist

- Double booking under concurrency
- Expired holds releasing capacity
- Webhook retries idempotent
- Draft workshops never public
- Preview routes noindex
- Local mode impossible in production

---

## 10. Work packages for Cursor (ordered)

Use these as chat titles / loop missions.

### WP-0 — Stabilize deploy & auth

Netlify handler size, env, admin login hard redirect, proxy cookies, prove `/admin` works on production.

### WP-1 — Catalog & sessions import

Turn `workshop-catalog-import` + Bruno-approved schedule into published DB rows; delete smoke leftovers when safe.

### WP-2 — CTA rewiring

Every rezerwacja control → first-party bookable route; redirect legacy booking-calendar URLs.

### WP-3 — Booking E2E hardening

Form UX, bank-transfer copy, success/cancel, capacity, idempotency, RLS re-check.

### WP-4 — Ops plumbing

Cron expiry, Resend, Upstash, optional Stripe test, admin bank-transfer confirm habit documented.

### WP-5 — Content & fidelity

Priority page polish, FAQ, legal cleanup, gallery/blog minimum content.

### WP-6 — SEO & cutover

Redirects, sitemap, DNS plan, Search Console, social link updates.

### WP-7 — Excellence

Reminders, ICS, analytics, enquiry forms, waitlist, admin day-view, performance pass.

---

## 11. Decision log (Bruno must answer)

Track answers here or in `tmp/overnight-completion/DECISIONS.md`.

1. Which workshops are **instant book** vs **enquiry only**?
2. Confirmed price list (gross PLN) per workshop?
3. Default capacity per room / offer?
4. First published calendar window (which dates)?
5. Bank transfer: exact account name, IBAN, transfer title format?
6. Stripe live: yes/no for launch week?
7. Shop / vouchers: hide for launch or keep archive pages?
8. FAQ: rewrite from scratch vs curated archive — Bruno provides answers?
9. DNS cutover date for `ceramikanero.com`?
10. Who are the admin users besides owner?
11. Photography rights / can we use all archive images?
12. Alcohol workshops: any special legal copy needed?

---

## 12. Smoke ladder (copy/paste after each deploy)

```text
[ ] Production build green on Netlify
[ ] /admin login → pulpit
[ ] /warsztaty has real published items
[ ] /kalendarz has real future sessions
[ ] Pick session → /termin/{id} 200
[ ] /warsztaty/{slug}/rezerwacja 200 with slots
[ ] Submit booking → success + reference
[ ] /admin/rezerwacje shows it; capacity correct
[ ] No SMOKE/TEST labels in public UI
[ ] Mobile booking once
```

---

## 13. “Gigantic” backlog — anything else that makes this a success

### Product completeness

- [ ] Workshop filters (age, date, category) that actually help parents
- [ ] “Only X seats left” urgency (honest, not dark pattern)
- [ ] Group booking rules (min participants for birthday packages)
- [ ] Instructor assignment visible when it matters
- [ ] Materials fee / firing fee clarity if applicable
- [ ] Weather / cancellation studio policy page
- [ ] Parking / transit blurb for Suchy Las visitors from Poznań

### Customer communication

- [ ] Email templates designed (not plaintext only)
- [ ] Reminder T−24h / T−2h
- [ ] Post-visit “thanks + gallery CTA” email
- [ ] WhatsApp click-to-chat (common in PL local services)
- [ ] Consistent phone number formatting

### Admin power features

- [ ] Printable attendance list per session
- [ ] Export CSV of bookings (accounting)
- [ ] No-show marking
- [ ] Partial refunds UX clarity
- [ ] Duplicate customer merge (later)
- [ ] Quick “clone last week’s schedule”

### Trust, legal, business

- [ ] RODO processes match `docs/PRIVACY.md`
- [ ] Cookie banner only if analytics require it
- [ ] Invoice / receipt needs? (ask accountant)
- [ ] Terms match actual payment methods (bank vs Stripe)
- [ ] Accessibility statement (nice)

### Growth

- [ ] SEO blog cadence plan
- [ ] Local SEO (Suchy Las / Poznań ceramika)
- [ ] Remarketing opt-in via marketing consent (already in booking form — use ethically)
- [ ] Partner / school group landing
- [ ] Seasonal campaigns (wakacje, Mikołajki, walentynki, dzień kobiet)

### Engineering quality

- [ ] Preview deployments on PRs
- [ ] Staging Supabase project (optional but wise before risky imports)
- [ ] Runbooks: “booking is down”, “webhook failed”, “cron missed”
- [ ] Load test `begin_booking` lightly before campaign blasts
- [ ] Dependency update cadence
- [ ] Remove dead Wix/webinar routes or 301 them consciously

### Brand craft

- [ ] Signature motion on hero / calendar (intentional, not noisy)
- [ ] Real clay textures / studio photos as anchors
- [ ] Microcopy in Polish that sounds like Gosia’s studio, not SaaS
- [ ] Joyful theme especially strong on kids paths; Atelier on adults/wine

---

## 14. Anti-goals (do not waste the all-day session)

- Do not invent FAQ or prices to “look complete”
- Do not enable `BOOKING_LOCAL_MODE` on Netlify
- Do not import polluted archive FAQ blindly
- Do not treat `/booking-calendar/*` as a finished booking system
- Do not chase pixel-perfect fidelity on every obscure Wix leftover before booking works
- Do not build a full shop before workshops book reliably
- Do not force-push or destroy production data without backup + approval

---

## 15. Suggested definition of “launch ready” vs “best in class”

### Launch ready (minimum)

- Admin login works on production
- All public rezerwacja CTAs for active offers book against Supabase
- Calendar shows real terminy
- Guest can complete bank-transfer booking on mobile
- Owner can find and manage that booking in admin
- Legal pages present; smoke data gone
- Cron expiry scheduled
- Confirmation email **or** explicit “sprawdź skrzynkę / przelew” UX that is honest

### Best in class (pursue next)

- Stripe live + beautiful emails + reminders
- Archive shells eliminated
- Visual fidelity on top routes
- Analytics + SEO cutover done
- Enquiry flows for firmy/urodziny/panieńskie that feel premium
- Admin day-of-class tools
- Performance and a11y scores competitive

---

## 16. Immediate next actions (start here next Cursor session)

Progress as of 2026-07-25 all-day session:

1. [x] **Reproduce** production rezerwacja / admin — rezerwacja was empty-DB (not code 404); admin soft-nav hang; browser login rewrite ready locally.
2. [~] **Deploy blockers** — bundle tracing already on `main`; admin login + CTAs + cron still need **Bruno push/deploy**.
3. [x] **Import + publish** catalog via `scripts/import-workshop-catalog.js --apply` (archive prices/cadences).
4. [x] **Create terminy** — ~6 weeks of recurring sessions for scheduled workshops.
5. [x] **Rewire CTAs** in code (homepage + archive adaptation + `/booking-calendar/*` → `/kalendarz`); deploy required for homepage.
6. [x] **RPC smoke ladder** passed (`CN-20260725-525B`); public calendar/form already live from DB. Next: deploy admin login, then Resend/Stripe/fidelity.

---

_This document is living. Update checkboxes and the decision log as reality changes. The north star stays the same: a parent or adult in Poznań/Suchy Las should trust this site enough to book clay with one hand on a phone — and Gosia should trust admin enough to run the studio from it every day._
