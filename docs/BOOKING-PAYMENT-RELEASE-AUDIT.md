# Ceramika Nero — booking and payment release audit

Audit date: 2026-07-29  
Baseline: `main` at `01aed6ca35b53c5b945e0db3a1ca13f9af6397d2`  
Audit branch: `audit/booking-payment-release-20260729`

## Decision

**NO-GO pending business/operational decisions, dependency review, and external
acceptance testing.**

No unresolved path that can charge a customer twice was reproduced after the
migration 19 repairs. The code and focused tests now enforce exclusive webhook
claims, authoritative amount/currency/mode validation, state-safe event
reordering, atomic manual payment and shipping transitions, recoverable
Checkout creation, truthful refund state, and a fixed `pg_catalog` search path
for the shared `SECURITY DEFINER` update trigger.

Release is nevertheless blocked by:

1. **P1 — abandoned unified orders:** an expired Stripe Checkout does not
   release workshop capacity or product inventory. Migration 19 provides an
   atomic `cancel_unpaid_order` operation, but no automatic duration was chosen.
   The owner must approve the hold/cancellation rule.
2. **P1 — mixed/unified-order refund allocation:** Stripe's cumulative refund is
   now recorded correctly, but the application cannot safely infer which order
   line, linked booking, seat, or product unit a partial refund belongs to.
   Migration 19 flags these cases for review instead of inventing semantics.
3. A full Supabase migration run and the Stripe sandbox scenarios remain
   external evidence requirements. Without actual sandbox execution the maximum
   possible result would be `CONDITIONAL GO`.
4. `npm audit --omit=dev` reports three high-severity and one moderate
   production-dependency advisories. Exposure and a framework-supported upgrade
   path must be assessed before release; this audit did not auto-change
   dependencies.

Disputes/chargebacks are not implemented. They must be handled manually in
Stripe and do not currently reduce application analytics. This is a documented
operational limitation, not a refund.

## Initial repository state

| Item                    | Observation                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| Remote                  | `brunonero90/CeramikaNero`                                             |
| Baseline branch/commit  | `main` / `01aed6ca35b53c5b945e0db3a1ca13f9af6397d2`                    |
| Initial worktree        | Clean isolated clone                                                   |
| Relevant dependencies   | Next `16.2.11`, React `19.2.4`, Stripe `22.3.2`, Vitest `3.0.0`        |
| Stripe API version      | No version is pinned in `new Stripe(...)`; SDK/account default applies |
| Existing migrations     | `00`–`18`, treated as frozen                                           |
| Local database tooling  | No Docker, Supabase CLI, `psql`, or PostgreSQL server                  |
| Remote-test environment | Supabase test variables absent                                         |

## Source-of-truth model

### Supported states

| Entity        | States                                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Order         | `awaiting_payment`, `confirmed`, `cancelled`, `expired`, `refunded`, `partially_refunded`                              |
| Order payment | `pending`, `paid`, `failed`, `cancelled`, `refunded`, `partially_refunded`                                             |
| Fulfilment    | `unfulfilled`, `partial`, `fulfilled`, `cancelled`                                                                     |
| Booking       | `pending`, `awaiting_payment`, `confirmed`, `cancelled`, `expired`, `refunded`, `partially_refunded`                   |
| Payment       | `created`, `pending`, `paid`, `failed`, `cancelled`, `partially_refunded`, `refunded`                                  |
| Stripe event  | `received`, `processed`, `failed`; migration 19 adds an exclusive processing lease                                     |
| Booking email | `confirmation`, `cancellation`, `refund`, `manual_confirmation`, `payment_problem`, `admin_notification`               |
| Order email   | creation/admin, shipping, payment, fulfilment, cancellation, refund, and payment-problem types defined by migration 15 |

### State transitions and authorities

| Operation                      | Permitted transition                             | Capacity/inventory                                                             | Email/event effect                                                |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `submit_cart_order_v2`         | none → awaiting payment                          | Reserves all lines atomically once                                             | Creation/admin outbox; safe token ledger                          |
| `begin_booking`                | none → pending/awaiting payment                  | Reserves seats once                                                            | Reserved event                                                    |
| Stripe Checkout creation       | payment created/failed → pending                 | No new reservation                                                             | Attempt binding only                                              |
| `confirm_*_from_stripe`        | pending/failed → paid; booking/order → confirmed | Reacquires a standalone expired booking only when safe                         | Confirmation once; manual-resolution event for terminal conflicts |
| Failure/expiry webhook         | matching active attempt → failed                 | No second mutation                                                             | Failure/expiry outbox once                                        |
| Manual payment RPC             | pending bank transfer → paid/confirmed           | No second reservation                                                          | Audit and confirmation once                                       |
| `set_order_shipping_quote`     | quote-required → payable                         | No reservation change                                                          | Recalculates order and payment atomically                         |
| Customer/staff cancellation    | active unpaid/eligible booking → cancelled       | Releases once                                                                  | Cancellation/audit event                                          |
| `cancel_unpaid_order`          | unpaid active order → cancelled                  | Releases linked seats and inventory once                                       | Cancellation event                                                |
| Stripe refund synchronization  | paid → partially/full refunded                   | Standalone full refund releases once; unified order requires allocation review | Refund/admin-review event                                         |
| Attendance/analytics exclusion | Operational metadata only                        | Must not change transactional state                                            | Audited                                                           |

The browser never owns totals or confirmation. Stripe webhooks are primary;
the return page retrieves the Checkout Session with the secret key and invokes
the same strict database confirmation.

## Invariants

| #   | Invariant                                                                                     | Evidence                                                                                        | Result                                     |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Prices, totals, shipping, capacity, inventory and Stripe line items are server-authoritative. | Cart RPCs, `privacy-boundaries.test.ts`, PGlite quote test                                      | `PROVED_INTEGRATION`                       |
| 2   | Money is integer grosz in PLN.                                                                | Schema constraints, checkout and `admin-money.test.ts`                                          | `PROVED_AUTOMATED`                         |
| 3   | Order creation mutates stock/capacity once and atomically.                                    | Existing remote SQL tests plus idempotent wrapper review                                        | `BLOCKED_EXTERNAL` for full Supabase proof |
| 4   | Submission retries/concurrency do not reserve twice.                                          | Per-submission UUID and unique idempotency RPC; final DB proof requires Supabase                | `BLOCKED_EXTERNAL`                         |
| 5   | A successful payment cannot create a second payable Checkout.                                 | `prepare_order_checkout_attempt`; PGlite competing-claim test; `order-checkout-attempt.test.ts` | `PROVED_INTEGRATION`                       |
| 6   | A Stripe order cannot be paid through the bank-transfer admin path.                           | Migration 19 manual-payment RPCs and admin action tests/source guard                            | `PROVED_AUTOMATED`                         |
| 7   | Browser query parameters cannot confirm payment.                                              | Reconciliation tests retrieve and validate Stripe Session                                       | `PROVED_AUTOMATED`                         |
| 8   | Return recovery retrieves the Session server-side.                                            | `reconcile-order-checkout.test.ts`                                                              | `PROVED_AUTOMATED`                         |
| 9   | Session/order/payment metadata and bindings must agree.                                       | Strict confirmation RPC and mismatch tests                                                      | `PROVED_AUTOMATED`                         |
| 10  | Amount and currency must agree before confirmation.                                           | Strict RPC; mismatch tests; PGlite confirmation                                                 | `PROVED_INTEGRATION`                       |
| 11  | Duplicate/out-of-order events are idempotent.                                                 | Exclusive claim RPC, stale-event tests, PGlite claims                                           | `PROVED_INTEGRATION`                       |
| 12  | A database failure remains retryable and does not consume the event.                          | Webhook 5xx/reclaim tests                                                                       | `PROVED_AUTOMATED`                         |
| 13  | Payment confirmation and confirmation email occur once.                                       | Unique outbox keys and webhook replay tests; external provider race still manually checked      | `MANUAL_REQUIRED`                          |
| 14  | A failed payment cannot confirm a booking.                                                    | Failure-handler tests and state-safe RPC                                                        | `PROVED_AUTOMATED`                         |
| 15  | Late success cannot silently resurrect terminal/refunded records.                             | Strict RPC state gates and PGlite stale-event checks                                            | `PROVED_INTEGRATION`                       |
| 16  | Capacity/inventory release is state-guarded and at most once.                                 | PGlite full-refund test; cancellation RPC; full Supabase concurrency still blocked              | `BLOCKED_EXTERNAL`                         |
| 17  | An expired old Session cannot cancel a newer successful attempt.                              | Exact attempt binding and stale-failure tests                                                   | `PROVED_AUTOMATED`                         |
| 18  | Shipping orders cannot be paid before a quote.                                                | Eligibility tests and atomic quote PGlite test                                                  | `PROVED_INTEGRATION`                       |
| 19  | Incomplete transfer configuration cannot leak partial instructions.                           | `bank-transfer.test.ts`, provider tests                                                         | `PROVED_AUTOMATED`                         |
| 20  | Test/unclassified Stripe activity is excluded from default analytics.                         | Migration 18 analytics tests and authoritative `livemode` stamping                              | `PROVED_AUTOMATED`                         |
| 21  | Stripe metadata contains no customer PII.                                                     | `privacy-boundaries.test.ts` and Checkout payload inspection                                    | `PROVED_AUTOMATED`                         |
| 22  | Public order state requires an opaque token.                                                  | Hashed public lookup implementation; cross-order manual attempt remains                         | `MANUAL_REQUIRED`                          |
| 23  | Public errors do not expose Stripe configuration/internal exceptions.                         | Provider fail-closed tests and safe Polish UI                                                   | `PROVED_AUTOMATED`                         |

## Coverage matrix

Each row states its precondition/action, expected order (`O`), booking (`B`),
payment (`P`), capacity/inventory (`C/I`), email/UI outcome, evidence, remaining
manual work, and release severity. `—` means the entity is not applicable.

Coverage totals:

| Classification       | Scenarios |
| -------------------- | --------: |
| `PROVED_AUTOMATED`   |        50 |
| `PROVED_INTEGRATION` |        13 |
| `MANUAL_REQUIRED`    |        28 |
| `BLOCKED_EXTERNAL`   |        19 |
| `FAILED`             |         3 |
| **Total**            |   **113** |

### A. Provider configuration

| ID  | Scenario / action                                          | O                                | B                | P                         | C/I               | Email / customer and admin UI                        | Evidence                                                | Result             | Manual                          | Severity |
| --- | ---------------------------------------------------------- | -------------------------------- | ---------------- | ------------------------- | ----------------- | ---------------------------------------------------- | ------------------------------------------------------- | ------------------ | ------------------------------- | -------- |
| A01 | `manual`, complete bank settings; submit known-total order | awaiting payment                 | awaiting payment | pending/manual            | reserve once      | Complete transfer values, no Stripe CTA              | `bank-transfer.test.ts`, provider tests                 | `PROVED_AUTOMATED` | Verify rendered email           | —        |
| A02 | `manual`, incomplete settings                              | no order from disabled choice    | —                | —                         | unchanged         | Transfer option blocked; no partial instructions     | `bank-transfer.test.ts`                                 | `PROVED_AUTOMATED` | —                               | —        |
| A03 | `stripe`, valid test key; start Checkout                   | awaiting payment                 | awaiting payment | pending/Stripe            | reserve once      | Redirect to sandbox Checkout                         | Checkout unit tests                                     | `MANUAL_REQUIRED`  | Complete sandbox payment        | —        |
| A04 | `stripe`, key missing/invalid                              | unchanged or safe creation error | unchanged        | not confirmed             | no extra mutation | Generic Polish unavailable message; no config detail | `provider.test.ts`                                      | `PROVED_AUTOMATED` | Invalid-key response in preview | P2       |
| A05 | `both`; explicitly select Stripe                           | awaiting payment                 | awaiting payment | pending/Stripe            | reserve once      | Stripe CTA only                                      | checkout schema/provider tests                          | `MANUAL_REQUIRED`  | Sandbox                         | —        |
| A06 | `both`; explicitly select transfer                         | awaiting payment                 | awaiting payment | pending/manual            | reserve once      | Complete transfer instructions                       | provider/bank tests                                     | `MANUAL_REQUIRED`  | Email rendering                 | —        |
| A07 | malformed provider value                                   | no unsafe fallback               | —                | —                         | unchanged         | Payments unavailable, generic message                | `provider.test.ts`                                      | `PROVED_AUTOMATED` | —                               | P2 fixed |
| A08 | test/live key, webhook, or object mismatch                 | no confirmation                  | no confirmation  | pending/manual resolution | unchanged         | Safe failure/admin evidence                          | strict `livemode` RPC; environment cannot exercise keys | `BLOCKED_EXTERNAL` | Sandbox/deploy-context check    | P0       |
| A09 | client bundle/log secret scan                              | —                                | —                | —                         | —                 | No secret exposed                                    | build/source scan; build gate                           | `PROVED_AUTOMATED` | Inspect deployed bundle         | P0       |

### B. Cart and order composition

| ID  | Scenario / action                                       | O                                                              | B                                      | P                          | C/I                          | Email / customer and admin UI       | Evidence                                      | Result               | Manual                    | Severity |
| --- | ------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- | -------------------------- | ---------------------------- | ----------------------------------- | --------------------------------------------- | -------------------- | ------------------------- | -------- |
| B01 | Workshop only; one participant                          | awaiting payment → confirmed after pay                         | same                                   | pending → paid             | one seat once                | Correct references and participant  | checkout field/webhook tests                  | `MANUAL_REQUIRED`    | End-to-end sandbox        | —        |
| B02 | Workshop, multiple participants                         | same                                                           | one linked booking                     | same                       | exact quantity once          | Grouped participants                | schema/checkout tests                         | `MANUAL_REQUIRED`    | End-to-end UI             | —        |
| B03 | Multiple sessions / repeated same session lines         | one aggregate order                                            | one booking per normalized line        | one order payment          | exact aggregate seats        | Correct summary                     | cart RPC remote coverage                      | `BLOCKED_EXTERNAL`   | Disposable Supabase + UI  | P1       |
| B04 | Product-only pickup, multiple quantities                | awaiting → confirmed                                           | —                                      | pending → paid             | exact stock once             | Pickup status                       | existing cart tests                           | `MANUAL_REQUIRED`    | End-to-end                | —        |
| B05 | Product-only shipping                                   | awaiting quote/pay                                             | —                                      | not payable → pending/paid | stock once                   | No demand before quote              | eligibility tests/PGlite quote                | `PROVED_INTEGRATION` | End-to-end                | —        |
| B06 | Mixed workshop + pickup product                         | awaiting → confirmed                                           | linked booking                         | pending → paid             | seats and stock atomically   | One order, consistent admin UI      | RPC requires full Supabase                    | `BLOCKED_EXTERNAL`   | Final-place integration   | P1       |
| B07 | Mixed workshop + shipped product                        | awaiting quote → confirmed                                     | linked booking                         | not payable → paid         | seats/stock once             | Quote then payment                  | RPC requires full Supabase                    | `BLOCKED_EXTERNAL`   | End-to-end                | P1       |
| B08 | Empty/malformed cart or excessive/negative quantity     | no order                                                       | —                                      | —                          | unchanged                    | Validation error                    | schemas/cart tests                            | `PROVED_AUTOMATED`   | —                         | —        |
| B09 | Browser-tampered price/total                            | server-priced order or rejection                               | server-priced                          | server-priced              | correct                      | No trusted browser money            | privacy/checkout tests                        | `PROVED_AUTOMATED`   | Proxy tamper optional     | P0       |
| B10 | Deleted/hidden/cancelled/past session                   | no order                                                       | —                                      | —                          | unchanged                    | Availability error                  | server revalidation; DB proof remote          | `BLOCKED_EXTERNAL`   | Disposable Supabase       | P1       |
| B11 | Workshop/product price changes after cart add           | current server price                                           | linked at current price                | correct total              | once                         | Checkout shows authoritative result | server pricing code                           | `MANUAL_REQUIRED`    | UI confirmation           | P1       |
| B12 | Age restriction, missing name/phone, accessibility note | validation blocks missing required values; valid note persists | valid existing records remain readable | —                          | unchanged until valid        | Exact Polish validation/admin note  | checkout tests                                | `PROVED_AUTOMATED`   | Browser form              | —        |
| B13 | Insufficient capacity/inventory                         | no partial order                                               | —                                      | —                          | rollback all                 | Safe availability message           | RPC remote tests unavailable                  | `BLOCKED_EXTERNAL`   | Disposable Supabase       | P0       |
| B14 | Two buyers race for final seat/unit                     | one wins, one fails                                            | only winner                            | only winner payable        | never negative/over capacity | Loser sees availability error       | row locks in RPC; no full DB concurrency here | `BLOCKED_EXTERNAL`   | Manual test 18 + Supabase | P0       |
| B15 | Double-click/network retry same submission UUID         | one order                                                      | one booking set                        | one payment                | once                         | Same portal link recovered          | submission UUID + RPC; DB test unavailable    | `BLOCKED_EXTERNAL`   | Supabase concurrency      | P0       |
| B16 | Later legitimate identical cart                         | new submission UUID, new order                                 | new bookings                           | new payment                | new intended reservation     | New reference                       | client/session key tests/source               | `PROVED_AUTOMATED`   | —                         | P1 fixed |

### C–G. Stripe success, failure, concurrency, webhook, and return recovery

| ID  | Scenario / action/event order                                        | O                                          | B                                      | P                                    | C/I                                | Email / customer and admin UI                  | Evidence                            | Result               | Manual                                    | Severity    |
| --- | -------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- | ------------------------------------ | ---------------------------------- | ---------------------------------------------- | ----------------------------------- | -------------------- | ----------------------------------------- | ----------- |
| C01 | Card success                                                         | confirmed                                  | confirmed                              | paid                                 | unchanged after original reserve   | Paid UI; one success email                     | webhook tests                       | `MANUAL_REQUIRED`    | Sandbox card                              | P0          |
| C02 | Successful 3DS card                                                  | confirmed                                  | confirmed                              | paid                                 | same                               | Same success result                            | strict generic success path         | `MANUAL_REQUIRED`    | Sandbox 3DS                               | P0          |
| C03 | BLIK success                                                         | confirmed                                  | confirmed                              | paid                                 | same                               | Same; async UI may process first               | async webhook tests                 | `MANUAL_REQUIRED`    | Sandbox BLIK                              | P0          |
| C04 | P24 success when enabled                                             | confirmed                                  | confirmed                              | paid                                 | same                               | Same                                           | generic async path                  | `MANUAL_REQUIRED`    | Sandbox P24                               | P0          |
| C05 | Webhook before return / browser closed                               | confirmed                                  | confirmed                              | paid                                 | same                               | Return later already paid; one email           | webhook replay tests                | `PROVED_AUTOMATED`   | Stripe delivery                           | P1          |
| C06 | Return before webhook / webhook unavailable                          | confirmed after verified Session           | confirmed                              | paid                                 | same                               | Reconciliation then paid; one email            | reconciliation tests                | `PROVED_AUTOMATED`   | Sandbox outage simulation                 | P1          |
| C07 | Webhook and return race / two success event types                    | confirmed once                             | confirmed once                         | paid once                            | no second mutation                 | one email/event                                | exclusive RPC/PGlite + unit tests   | `PROVED_INTEGRATION` | Provider-level replay                     | P0          |
| C08 | Refresh/second tab after payment                                     | confirmed                                  | confirmed                              | paid                                 | same                               | CTA absent, scoped status only                 | eligibility/status tests            | `PROVED_AUTOMATED`   | Browser                                   | —           |
| C09 | Authoritative `livemode` on success                                  | confirmed                                  | confirmed                              | paid, mode stamped                   | same                               | Analytics classifies correctly                 | webhook/reconcile tests             | `PROVED_AUTOMATED`   | Test/live deploy check                    | P1          |
| D01 | Ordinary/insufficient/invalid card decline                           | awaiting                                   | awaiting                               | failed/retryable                     | original hold only                 | No success email; safe decline UI              | failure tests                       | `MANUAL_REQUIRED`    | Sandbox cards                             | P1          |
| D02 | 3DS issuer decline/auth failure                                      | awaiting                                   | awaiting                               | failed/retryable                     | same                               | No success email                               | state-safe failure handler          | `MANUAL_REQUIRED`    | Sandbox cards                             | P1          |
| D03 | Customer exits Checkout/P24 cancellation                             | awaiting                                   | awaiting                               | pending until expiry/retry           | same                               | Cancel page; pay remains eligible              | eligibility code                    | `MANUAL_REQUIRED`    | Browser                                   | —           |
| D04 | BLIK invalid code                                                    | awaiting                                   | awaiting                               | failed/retryable                     | same                               | Safe failure, no success email                 | async failure tests                 | `MANUAL_REQUIRED`    | Sandbox BLIK                              | P1          |
| D05 | BLIK delayed decline/timeout                                         | awaiting                                   | awaiting                               | failed/retryable                     | same                               | Processing then failure                        | async failure tests                 | `MANUAL_REQUIRED`    | Sandbox BLIK                              | P1          |
| D06 | Checkout expiry                                                      | awaiting                                   | awaiting                               | matching attempt failed              | hold remains until explicit cancel | Expired notice/no success email                | webhook tests                       | `PROVED_AUTOMATED`   | Approve auto-cancel rule                  | **P1 open** |
| D07 | Network loss after Checkout creation                                 | awaiting                                   | awaiting                               | pending with persisted claim/key     | no extra reserve                   | Retry recovers Session or safely resumes       | attempt tests/PGlite                | `PROVED_INTEGRATION` | Stripe sandbox interruption               | P1          |
| D08 | `checkout=success` but unpaid/missing Session                        | unchanged                                  | unchanged                              | not paid                             | unchanged                          | Safe processing/error; no confirmation         | reconciliation tests                | `PROVED_AUTOMATED`   | Browser                                   | P1          |
| D09 | Session for another order / wrong token                              | unchanged                                  | unchanged                              | unchanged                            | unchanged                          | No cross-order data                            | mismatch tests                      | `PROVED_AUTOMATED`   | Manual stolen-ID attempt                  | P0          |
| D10 | Failed attempt(s), then successful retry                             | confirmed                                  | confirmed                              | paid                                 | no second reserve                  | One success email                              | attempt/failure/success tests       | `PROVED_AUTOMATED`   | Sandbox sequence                          | P0          |
| D11 | Old failure after newer success                                      | confirmed                                  | confirmed                              | paid                                 | unchanged                          | No false failure email                         | stale-event tests/PGlite            | `PROVED_INTEGRATION` | —                                         | P0          |
| D12 | Old success after failure                                            | confirmed if valid/current relationship    | confirmed                              | paid                                 | unchanged                          | One success email                              | strict success tests                | `PROVED_AUTOMATED`   | —                                         | P1          |
| D13 | Expired old Session after new success                                | confirmed                                  | confirmed                              | paid                                 | unchanged                          | Old event ignored                              | exact attempt binding tests         | `PROVED_AUTOMATED`   | —                                         | P0          |
| E01 | Double-click/two tabs race before Checkout creation                  | awaiting                                   | awaiting                               | one claimed attempt                  | unchanged                          | One redirect; competitor receives processing   | PGlite + attempt tests              | `PROVED_INTEGRATION` | Browser two-tab                           | P0          |
| E02 | Existing open Session / processing PI                                | awaiting                                   | awaiting                               | existing pending attempt             | unchanged                          | Existing URL/status reused                     | checkout attempt code/tests         | `PROVED_AUTOMATED`   | Stripe API                                | P0          |
| E03 | Stripe paid while local unpaid / reconciliation race                 | confirmed through strict recovery          | confirmed                              | paid                                 | unchanged                          | Manual-resolution route if terminal            | reconciliation/webhook tests        | `PROVED_AUTOMATED`   | Sandbox recovery                          | P1          |
| E04 | Second Checkout after confirmation/refund/terminal state             | terminal state unchanged                   | unchanged                              | no new payable attempt               | unchanged                          | CTA blocked                                    | eligibility and RPC tests           | `PROVED_AUTOMATED`   | —                                         | P0          |
| E05 | Genuine failed attempt retry/idempotency-key lifecycle               | awaiting → confirmed                       | same                                   | failed → pending → paid              | unchanged                          | Retry not permanently blocked                  | persisted per-attempt key tests     | `PROVED_INTEGRATION` | Stripe API                                | P0          |
| F01 | Seven original subscribed events: signature, validation, idempotency | state by verified event                    | state by verified event                | state by verified event              | guarded                            | Correct 2xx/5xx; safe logs                     | webhook route/unit tests            | `PROVED_AUTOMATED`   | Stripe CLI/sandbox                        | P0          |
| F02 | `refund.updated` succeeded / `refund.failed`                         | refund synchronized / unchanged on failure | standalone full closes; unified review | cumulative refund / failure recorded | release only standalone full       | Refund/admin-problem evidence                  | refund webhook tests/PGlite         | `PROVED_INTEGRATION` | Subscribe two events, sandbox async cards | P1          |
| F03 | Invalid/missing signature or malformed JSON                          | unchanged                                  | unchanged                              | unchanged                            | unchanged                          | 400, no details/secrets                        | route implementation                | `MANUAL_REQUIRED`    | Signed/unsigned HTTP calls                | P0          |
| F04 | Unsupported event                                                    | unchanged                                  | unchanged                              | unchanged                            | unchanged                          | safe 2xx after verified claim                  | handler tests/source                | `PROVED_AUTOMATED`   | —                                         | —           |
| F05 | Duplicate same ID / two IDs same object                              | one transition                             | one transition                         | one transition                       | once                               | one email                                      | event and entity idempotency tests  | `PROVED_INTEGRATION` | Stripe replay                             | P0          |
| F06 | Concurrent/out-of-order delivery                                     | terminal truth preserved                   | truth preserved                        | truth preserved                      | once                               | owner gets retryable 503 for in-progress claim | PGlite/ordering tests               | `PROVED_INTEGRATION` | Provider replay                           | P0          |
| F07 | Handler/DB exception then retry                                      | initially unchanged; later correct         | same                                   | failed claim then recovered          | unchanged until success            | 5xx then 2xx; no lost event                    | webhook retry tests                 | `PROVED_AUTOMATED`   | —                                         | P1          |
| F08 | Amount/currency/metadata/entity/relation mismatch or unknown ID      | no confirmation                            | no confirmation                        | pending/manual resolution            | unchanged                          | Safe failure/admin evidence                    | strict RPC/tests                    | `PROVED_AUTOMATED`   | —                                         | P0          |
| F09 | Test/live classification and PII-safe logging                        | valid mode only                            | valid mode only                        | mode stamped                         | unchanged                          | No PII/secrets                                 | privacy/provider tests              | `PROVED_AUTOMATED`   | deployed log review                       | P0          |
| F10 | Dispute/chargeback event                                             | application unchanged                      | unchanged                              | incorrectly remains collected in app | unchanged                          | Must be handled manually in Stripe             | no handler exists                   | `FAILED`             | Define manual procedure or future feature | **P1 open** |
| G01 | Browser flags alone / unpaid or expired Session                      | unchanged                                  | unchanged                              | not paid                             | unchanged                          | No paid UI/email                               | reconciliation tests                | `PROVED_AUTOMATED`   | —                                         | P0          |
| G02 | Paid Session, matching opaque token/metadata/amount/currency         | confirmed                                  | confirmed                              | paid                                 | unchanged                          | Bounded refresh to paid state                  | reconciliation tests                | `PROVED_AUTOMATED`   | Sandbox                                   | P1          |
| G03 | Stripe temporarily unavailable                                       | unchanged                                  | unchanged                              | unchanged                            | unchanged                          | Safe retry, no infinite polling                | bounded reconciliation source/tests | `MANUAL_REQUIRED`    | Network simulation                        | P2          |
| G04 | Guessed/stolen Session ID or token substitution                      | unchanged                                  | unchanged                              | unchanged                            | unchanged                          | No private cross-order data                    | mismatch test + hashed lookup       | `MANUAL_REQUIRED`    | Browser substitution                      | P0          |

### H–K. Manual transfer, shipping, cancellation/refunds, and booking lifecycle

| ID  | Scenario / action                                    | O                                                                               | B                                           | P                                                       | C/I                                    | Email / customer and admin UI          | Evidence                                      | Result               | Manual                       | Severity    |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------------------- | -------------------- | ---------------------------- | ----------- |
| H01 | Known-total transfer with complete settings          | awaiting → confirmed by owner/manager                                           | same                                        | pending → paid/manual                                   | reserve once                           | Correct recipient/account/title/amount | bank/admin tests                              | `MANUAL_REQUIRED`    | Full UI/email                | P1          |
| H02 | Incomplete settings or malformed provider            | no payment demand                                                               | unchanged                                   | unchanged                                               | unchanged                              | No partial bank data                   | provider/bank tests                           | `PROVED_AUTOMATED`   | —                            | P1          |
| H03 | Owner/manager marks transfer paid twice              | confirmed once                                                                  | confirmed once                              | paid once                                               | unchanged                              | One history/email                      | atomic manual RPC                             | `BLOCKED_EXTERNAL`   | Supabase role/idempotency    | P0          |
| H04 | Editor/anonymous attempts mark paid                  | unchanged                                                                       | unchanged                                   | unchanged                                               | unchanged                              | Forbidden                              | server role check/RPC grant                   | `MANUAL_REQUIRED`    | Role matrix                  | P0          |
| H05 | Stripe-selected/already paid order marked manual     | unchanged                                                                       | unchanged                                   | unchanged                                               | unchanged                              | Action rejected                        | manual RPC/tests                              | `PROVED_AUTOMATED`   | —                            | P0          |
| H06 | Transfer cancellation before/after payment           | unpaid may cancel; paid requires explicit refund path                           | linked state consistent                     | pending cancelled; paid protected                       | release once only unpaid cancel        | Audit/email                            | cancellation RPC                              | `BLOCKED_EXTERNAL`   | Supabase workflow            | P1          |
| H07 | Manual-transfer expiration policy                    | no timed hold by design                                                         | remains held                                | pending                                                 | remains reserved                       | Admin must cancel manually             | documented behavior                           | `MANUAL_REQUIRED`    | Owner accepts policy         | **P1 open** |
| H08 | Analytics and NRB formatting                         | transactional state unaffected                                                  | unaffected                                  | paid/manual classified                                  | unchanged                              | Correct transfer value                 | analytics/bank tests                          | `PROVED_AUTOMATED`   | Dashboard check              | —           |
| I01 | Shipping order before quote                          | awaiting quote                                                                  | linked workshop remains awaiting            | not payable                                             | reserved once                          | No CTA/account/email demand            | eligibility tests                             | `PROVED_AUTOMATED`   | UI                           | P0          |
| I02 | Authorized quote confirmation                        | awaiting payment                                                                | unchanged                                   | pending at exact new total                              | unchanged                              | Correct method-specific action/email   | PGlite quote test                             | `PROVED_INTEGRATION` | Role/UI                      | P1          |
| I03 | Duplicate/concurrent quote confirmation              | one total                                                                       | unchanged                                   | one matching total                                      | unchanged                              | Idempotent or safe conflict            | atomic row-lock RPC                           | `BLOCKED_EXTERNAL`   | Supabase concurrency         | P0          |
| I04 | Negative, overflow, exponent, malformed quote        | unchanged                                                                       | unchanged                                   | unchanged                                               | unchanged                              | Validation error                       | `admin-money.test.ts`                         | `PROVED_AUTOMATED`   | —                            | P0          |
| I05 | Cancel before/after quote, before payment            | cancelled by atomic unpaid transition                                           | linked cancelled                            | cancelled                                               | releases once                          | Cancellation status                    | RPC needs full schema                         | `BLOCKED_EXTERNAL`   | Supabase                     | P1          |
| I06 | Stripe/transfer payment after quote                  | confirmed                                                                       | confirmed                                   | paid at quoted total                                    | unchanged                              | Correct success/instructions           | strict amount binding                         | `MANUAL_REQUIRED`    | Sandbox/manual               | P1          |
| J01 | Customer cancellation outside/inside 24-hour window  | eligible cancels; ineligible unchanged                                          | eligible cancelled                          | refund pending/succeeded truthfully                     | eligible release once                  | Exact policy UI/email                  | datetime/cancellation tests                   | `MANUAL_REQUIRED`    | Europe/Warsaw UI             | P1          |
| J02 | Admin cancellation before payment / repeated         | cancelled once                                                                  | cancelled once                              | cancelled                                               | release once                           | One audit/email                        | cancellation RPC                              | `BLOCKED_EXTERNAL`   | Supabase                     | P1          |
| J03 | Cancellation while processing / after paid           | no unsafe generic state mutation                                                | no false cancellation                       | processing/paid preserved until explicit refund outcome | no premature release                   | Admin must use dedicated action        | admin guards                                  | `PROVED_AUTOMATED`   | Workflow                     | P0          |
| J04 | Late payment after cancellation                      | terminal order/booking not resurrected                                          | terminal                                    | paid flagged for manual resolution                      | not reacquired silently                | Admin payment problem                  | strict confirmation RPC                       | `PROVED_INTEGRATION` | Sandbox                      | P1          |
| J05 | Pending cleanup/Stripe expiry/orphan unified order   | awaiting until explicit cancel                                                  | awaiting                                    | failed/pending                                          | continues holding                      | Diagnostic identifies hold             | diagnostic SQL and source                     | `FAILED`             | Approve expiry rule          | **P1 open** |
| J06 | Full standalone Stripe refund                        | —                                                                               | refunded                                    | refunded                                                | releases seats once                    | Refund status/email                    | PGlite/refund tests                           | `PROVED_INTEGRATION` | Sandbox                      | P1          |
| J07 | Partial/multiple standalone refunds to full          | —                                                                               | active until cumulative full, then refunded | partial → full                                          | release only at full                   | Truthful cumulative status             | safe refund RPC; full DB sequence unavailable | `BLOCKED_EXTERNAL`   | Supabase + sandbox           | P1          |
| J08 | Duplicate/out-of-order/pending/failed refund events  | financial truth never advances on pending/failure; cumulative Stripe total wins | no false close                              | synchronized only on success                            | no false release                       | Failure/admin evidence                 | webhook/admin tests                           | `PROVED_AUTOMATED`   | Async sandbox cards          | P1          |
| J09 | Refund one part of mixed/multi-booking order         | order financially partial/full and flagged                                      | allocation intentionally unchanged          | cumulative amount correct                               | intentionally unchanged pending review | Admin review required                  | migration 19 explicit event                   | `FAILED`             | Approve allocation semantics | **P1 open** |
| J10 | Revenue analytics after refund                       | net collected subtracts recorded refund                                         | —                                           | correct cumulative refund                               | —                                      | Dashboard net/refund values            | migration 18 tests + sync RPC                 | `PROVED_AUTOMATED`   | Dashboard sandbox            | P1          |
| K01 | Participant/purchaser validation and note round-trip | valid aggregate                                                                 | linked correctly                            | —                                                       | exact seats                            | Names/phone required; notes separate   | checkout tests                                | `PROVED_AUTOMATED`   | UI                           | —           |
| K02 | Booking statuses, unique reference, order link       | consistent                                                                      | lifecycle constrained                       | linked                                                  | guarded                                | Correct detail/status                  | schema/tests                                  | `BLOCKED_EXTERNAL`   | Supabase constraints         | P1          |
| K03 | Manual/complimentary booking                         | —                                                                               | pending/confirmed as chosen                 | manual/complimentary                                    | exact seats                            | Admin audit/email                      | existing booking tests remote                 | `BLOCKED_EXTERNAL`   | Supabase                     | P1          |
| K04 | Europe/Warsaw 24-hour/DST boundaries                 | —                                                                               | eligibility correct                         | unchanged                                               | unchanged                              | Correct Polish time/policy             | datetime tests                                | `PROVED_AUTOMATED`   | Browser timezone             | —           |
| K05 | Capacity boundary/cancel/failure retry               | —                                                                               | consistent                                  | failure does not reserve again                          | exact/release once                     | Correct availability                   | full DB concurrency unavailable               | `BLOCKED_EXTERNAL`   | Supabase                     | P0          |
| K06 | Attendance/exclusion/session completion              | order unchanged                                                                 | booking unchanged                           | payment unchanged                                       | unchanged                              | Audited operational-only changes       | migration 18 tests                            | `PROVED_AUTOMATED`   | Admin mobile                 | P1          |

### L. Email outboxes

| ID  | Scenario / action                                                 | O                             | B               | P               | C/I       | Email / customer and admin UI                             | Evidence                                 | Result             | Manual                      | Severity |
| --- | ----------------------------------------------------------------- | ----------------------------- | --------------- | --------------- | --------- | --------------------------------------------------------- | ---------------------------------------- | ------------------ | --------------------------- | -------- |
| L01 | Creation/awaiting-Stripe email and paid-before-delay suppression  | unchanged                     | unchanged       | pending/paid    | unchanged | Correct message or suppression                            | email tests/source                       | `PROVED_AUTOMATED` | Provider delivery           | P1       |
| L02 | Payment success/failure/processing                                | truth unchanged by email      | truth unchanged | truth unchanged | unchanged | Correct type once; no success on failure                  | webhook/email tests                      | `PROVED_AUTOMATED` | Inbox                       | P1       |
| L03 | Quote requested/confirmed, transfer instructions                  | unchanged                     | unchanged       | unchanged       | unchanged | No premature demand; complete post-quote message          | eligibility/templates                    | `MANUAL_REQUIRED`  | Inbox rendering             | P1       |
| L04 | Cancellation/refund/admin/booking messages                        | truth unchanged by email      | truth unchanged | truth unchanged | unchanged | Appropriate transactional type                            | templates/tests                          | `MANUAL_REQUIRED`  | Inbox rendering             | P2       |
| L05 | Dispatcher retry, concurrent workers, already sent                | unchanged                     | unchanged       | unchanged       | unchanged | Migration 19 atomically claims rows                       | RPC/source; no full Supabase concurrency | `BLOCKED_EXTERNAL` | Supabase workers            | P1       |
| L06 | Provider timeout/poison recipient                                 | transactional success remains | remains         | remains         | unchanged | Failed ledger is retryable; safe log                      | transport tests                          | `PROVED_AUTOMATED` | Resend sandbox              | P1       |
| L07 | Webhook replay and uniqueness keys                                | unchanged                     | unchanged       | unchanged       | unchanged | No duplicate ledger row                                   | webhook tests/unique keys                | `PROVED_AUTOMATED` | Provider idempotency manual | P1       |
| L08 | No secrets/Stripe IDs/unnecessary PII in logs; canonical contacts | unchanged                     | unchanged       | unchanged       | unchanged | Logs use safe references; templates use canonical contact | source/test scan                         | `PROVED_AUTOMATED` | Production log/inbox        | P0       |

### M. Authorization and privacy

| ID  | Scenario / action                                 | O                           | B                          | P                          | C/I       | Email / customer and admin UI                      | Evidence                                 | Result               | Manual                    | Severity |
| --- | ------------------------------------------------- | --------------------------- | -------------------------- | -------------------------- | --------- | -------------------------------------------------- | ---------------------------------------- | -------------------- | ------------------------- | -------- |
| M01 | Correct/wrong opaque customer token               | scoped order only / no data | scoped linked state        | scoped display             | unchanged | Wrong token reveals nothing                        | hashed lookup/source                     | `MANUAL_REQUIRED`    | Browser substitution      | P0       |
| M02 | Owner/manager/editor/anonymous admin matrix       | only permitted mutations    | only permitted mutations   | only permitted mutations   | guarded   | 403/hidden action                                  | server role checks/RPC grants            | `MANUAL_REQUIRED`    | Four-role test            | P0       |
| M03 | Attendance/exclusion authorization                | transaction unchanged       | transaction unchanged      | unchanged                  | unchanged | owner/manager only, audited                        | migration 18 tests                       | `PROVED_AUTOMATED`   | UI roles                  | P0       |
| M04 | Webhook verification/service role/RLS             | verified Stripe only        | same                       | same                       | guarded   | No public service access                           | route/RLS source tests                   | `BLOCKED_EXTERNAL`   | Supabase grant inspection | P0       |
| M05 | `SECURITY DEFINER` fixed `search_path` and grants | only intended RPC result    | same                       | same                       | guarded   | No arbitrary privilege path                        | migration 19 PGlite compile/source audit | `PROVED_INTEGRATION` | Supabase roles            | P0       |
| M06 | Arbitrary UUID substitution                       | no cross-entity transition  | no cross-entity transition | no cross-entity transition | unchanged | Safe error                                         | strict relationship RPC/tests            | `PROVED_AUTOMATED`   | HTTP adversarial test     | P0       |
| M07 | CSV/print authorization and `no-store`            | unchanged                   | unchanged                  | unchanged                  | unchanged | no unauthorized PII/cache                          | migration 18 route tests                 | `PROVED_AUTOMATED`   | Browser cache/roles       | P0       |
| M08 | Analytics PII/test exclusion                      | unchanged                   | unchanged                  | unchanged                  | unchanged | aggregate only; default excludes test/unclassified | analytics tests                          | `PROVED_AUTOMATED`   | Network payload inspect   | P0       |
| M09 | Repository/client/snapshot secret scan            | unchanged                   | unchanged                  | unchanged                  | unchanged | no secret present                                  | source/build scan                        | `PROVED_AUTOMATED`   | Deployed asset scan       | P0       |

## Findings and repairs

### P0

No unresolved P0 was reproduced after repairs.

### P1 repaired by migration 19 and application changes

1. Standalone booking webhooks were claimed before the legacy confirmation RPC,
   causing the RPC to report an already processed event without confirming.
2. `payment_intent.succeeded` did not validate Stripe's actual amount/currency.
3. Checkout and PaymentIntent success did not consistently stamp authoritative
   `livemode`.
4. A late failure/expiry could regress a newer paid attempt and queue a false
   failure message.
5. Webhook event claims were not exclusive while status was `received`.
6. Checkout retry reused a Stripe idempotency key without a matching durable
   database attempt claim; concurrent creators could race.
7. Shipping quote mutation was not atomic/state-guarded and did not synchronize
   the payment amount.
8. Manual booking/order payment confirmation was not atomic and did not
   uniformly reject Stripe-selected records.
9. The generic admin order status action could create inconsistent financial,
   booking, capacity, or inventory state.
10. `charge.refunded` was effectively a no-op, pending refunds could be recorded
    as complete, and later asynchronous refund failures were not handled.
11. Payment method persistence happened after the atomic cart RPC and could
    leave a partially initialized order.
12. A deterministic cart-content idempotency key blocked later legitimate
    identical orders and did not reliably recover the portal token.
13. Order email workers selected rows before claiming them, allowing concurrent
    dispatchers to race.
14. A Stripe API network exception reset the durable Checkout attempt, allowing
    a retry to use a new idempotency key even if Stripe had created the first
    Session.
15. Webhook claim/completion RPC failures could fall back to a best-effort
    ledger path and return success without a durable processed state.
16. Identical partial refunds shared an amount-based Stripe idempotency key but
    could be added to the local cumulative total twice; refund operations now
    carry a per-click UUID, Stripe refund ID, and expected cumulative total.
17. Free-text refund and cancellation reasons could be copied into Stripe
    metadata or operational event metadata. They now remain only in protected
    transactional columns; audit events contain safe flags and amounts.
18. Recoverable raw order portal tokens were stored in owner-visible event
    metadata. Migration 19 relocates existing values to an RLS-protected,
    service-role-only recovery table and sanitizes the old event metadata.
19. The shared `set_updated_at` `SECURITY DEFINER` trigger inherited the
    caller's search path. Migration 19 pins it to `pg_catalog` and fully
    qualifies its time functions.

Every repair is additive. Migrations `00`–`18` were not edited.

### Open P1

- Automatic expiration/release policy for abandoned unified orders.
- Refund allocation across mixed/unified order lines and linked bookings.
- Chargeback/dispute operational and analytics policy.
- Production dependency advisories, especially the Sharp/libvips findings,
  pending exposure and supported-upgrade assessment.
- Full Supabase migration/concurrency evidence and Stripe sandbox acceptance.

### P2/P3

- Direct standalone-booking email sends still depend on the local outbox
  uniqueness guard rather than a provider idempotency key; verify provider
  delivery during replay testing.
- The baseline repository has 34 Prettier-format failures unrelated to this
  audit. Changed files are formatted separately, which reduced the remaining
  baseline list to 31; the unrelated debt remains visible.

## Files changed

| Area                     | Files                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database                 | `supabase/migrations/00000000000019_payment_release_hardening.sql`                                                                                                                                                                                                                                                                                                                                                                        |
| Stripe/reconciliation    | `lib/booking/payment.ts`, `lib/booking/stripe-webhook.ts`, `lib/cart/order-checkout.ts`, `lib/cart/reconcile-order-checkout.ts`                                                                                                                                                                                                                                                                                                           |
| Cart/provider            | `lib/cart/checkout.ts`, `components/clone/checkout-page-client.tsx`, `lib/payments/provider.ts`, `lib/payments/admin-money.ts`, `lib/database/schema.ts`                                                                                                                                                                                                                                                                                  |
| Admin/customer mutations | `app/admin/(protected)/rezerwacje/actions.ts`, `app/admin/(protected)/rezerwacje/[id]/BookingDetailActions.tsx`, `app/admin/(protected)/zamowienia/actions.ts`, `app/rezerwacja/anulowanie/actions.ts`                                                                                                                                                                                                                                    |
| Email                    | `lib/booking/email-transport.ts`, `lib/cart/order-email.ts`, `lib/cart/order-email-dispatch.ts`                                                                                                                                                                                                                                                                                                                                           |
| Tests                    | `lib/booking/__tests__/payment.test.ts`, `lib/booking/__tests__/schemas.test.ts`, `lib/booking/__tests__/stripe-webhook.test.ts`, `lib/cart/__tests__/order-stripe-webhook.test.ts`, `lib/cart/__tests__/reconcile-order-checkout.test.ts`, `lib/cart/__tests__/order-checkout-attempt.test.ts`, `lib/cart/__tests__/privacy-boundaries.test.ts`, `lib/payments/__tests__/provider.test.ts`, `lib/payments/__tests__/admin-money.test.ts` |
| Operations/docs          | `scripts/audit-booking-payment-consistency.sql`, `docs/BOOKING-PAYMENT-RELEASE-AUDIT.md`, `docs/MANUAL-PAYMENT-ACCEPTANCE.md`, `docs/PAYMENT-FLOWS.md`, `docs/BOOKINGS.md`, `package.json`                                                                                                                                                                                                                                                |

## Migration 19

`00000000000019_payment_release_hardening.sql` adds:

- exclusive claim/complete/fail/reclaim RPCs for Stripe events;
- strict Stripe confirmation RPCs for orders and standalone bookings;
- state-safe payment failure/expiry handling;
- cumulative refund synchronization and explicit refund-failure recording;
- idempotent standalone booking refund recording with cumulative-total checks;
- atomic cart submission v2, service-only portal-token recovery, and
  payment-method setup;
- cancellation audit sanitization that keeps free text out of event metadata;
- atomic manual payment confirmation for orders and bookings;
- atomic shipping quote confirmation and payment-total synchronization;
- atomic unpaid-order cancellation with one-time resource release;
- atomic Checkout-attempt preparation with durable idempotency key;
- atomic order-email dispatch claims;
- fixed `search_path`, service-role grants, and revocation from public roles.

It deliberately does not auto-expire orders or allocate unified-order refunds.

## Test evidence and skipped inventory

### Automated

- Focused command: `npm run test:payments`
- Focused result: 113 passed, 11 skipped.
- Full-suite result and final gates are recorded below after the final run.
- Added/expanded tests cover authoritative confirmation fields, stale events,
  webhook lease contention/retry, async refund failure, order Checkout attempt
  contention, provider fail-closed behavior, and strict monetary input.

### PostgreSQL-compatible harness

A temporary PGlite harness executed migration 19 against a representative
migration-18 schema and proved:

- first webhook claim wins and the concurrent claim returns `in_progress`;
- strict standalone confirmation reaches paid/confirmed once;
- stale failure cannot regress paid state;
- quote confirmation synchronizes order and payment totals;
- one Checkout creator wins a competing claim;
- full standalone refund closes the booking and releases its seat;
- replaying the same refund operation does not increment the cumulative refund;
- the read-only consistency diagnostic parses and executes.

This is useful SQL execution evidence, but it is not presented as a substitute
for applying migrations `00`–`19` in Supabase.

### Skipped tests

Exactly 25 baseline tests are conditionally skipped:

- 14 in `lib/database/__tests__/integration.remote.test.ts`;
- 11 in `lib/database/__tests__/bookings.remote.test.ts`.

All require remote Supabase environment variables. They cover constraints,
atomic order creation, booking concurrency/capacity, cancellation, expiry,
refund, and authorization paths and therefore materially affect release
confidence. None was silently treated as passed.

## Read-only production diagnostic

Run `scripts/audit-booking-payment-consistency.sql` in Supabase SQL Editor
before migration/deployment and after the test deployment. It returns only
counts and non-PII references for payment/order/booking mismatches, duplicate
successful payments, capacity/inventory problems, payable terminal records,
retryable webhook events, email-key duplicates, unclassified Stripe rows,
analytics-exclusion mismatches, expired holds, and unified refunds requiring
allocation review. It performs no writes.

## Operational recovery: Stripe paid, application unpaid

1. Do not ask the customer to pay again.
2. In Stripe, verify mode, amount, currency, Checkout Session, PaymentIntent,
   and the application's non-PII order/payment metadata.
3. In admin, record the order/payment reference and current state; do not use
   “mark paid” on a Stripe-selected order.
4. Check the webhook delivery. Retry the verified failed delivery after the
   database/application fault is fixed.
5. If the event is still processing, wait for the retryable lease rather than
   creating a second Checkout.
6. Let the strict webhook/return reconciliation confirm it. If the order was
   cancelled/expired or resources are unavailable, leave it in manual
   resolution and either refund in Stripe or agree another session/product with
   the customer.
7. Verify one payment success ledger entry, consistent linked bookings, no
   overselling, and one customer confirmation email.

Never force database status fields independently.

## Quality gates

| Gate                    | Result                                                                       |
| ----------------------- | ---------------------------------------------------------------------------- |
| Dependency install      | Pass (`npm ci`)                                                              |
| Baseline full tests     | 277 passed, 25 skipped                                                       |
| Baseline typecheck      | Pass                                                                         |
| Baseline lint           | Pass with two pre-existing stub warnings                                     |
| Baseline build          | Pass                                                                         |
| Baseline format check   | Fail: 34 pre-existing files                                                  |
| Migration 19 PGlite     | Pass                                                                         |
| Focused payment tests   | 113 passed, 11 skipped                                                       |
| Changed-file formatting | Pass                                                                         |
| Final format check      | Fail: 31 unrelated pre-existing files                                        |
| Final lint              | Pass with the same two pre-existing stub warnings                            |
| Final typecheck         | Pass                                                                         |
| Final full tests        | 301 passed, 25 explicitly skipped                                            |
| Final production build  | Pass                                                                         |
| `git diff --check`      | Pass                                                                         |
| `npm audit --omit=dev`  | Report-only failure: 3 high, 1 moderate; no automatic dependency fix applied |

The dependency report identifies high-severity advisories in Next's transitive
PostCSS and Sharp dependencies and a moderate `file-type` advisory. It reports
no fix for the PostCSS or `file-type` findings and an available `npm audit fix`
for Sharp. Dependency changes were intentionally not made automatically; review
the framework-supported upgrade path separately.

## Required release/deployment order

Do not deploy while the decision is `NO-GO`.

After the open business rules are resolved and tested:

1. Back up the database and run the read-only diagnostic.
2. Exercise a staging/test database upgrade from migration 18 to 19 and a fresh
   migration `00`→`19`.
3. Apply migration 19 to Supabase.
4. Deploy the matching application build.
5. Add `refund.updated` and `refund.failed` to the existing Stripe webhook
   destination (nine events in total). Keep the matching mode-specific
   `whsec_...`.
6. Run `docs/MANUAL-PAYMENT-ACCEPTANCE.md` with test keys.
7. Re-run the diagnostic and resolve every P0/P1 inconsistency.
8. Only then repeat the smallest real-payment smoke test after switching to
   live keys.

No migration was applied, no remote data/configuration was changed, and nothing
was pushed or deployed during this audit.
