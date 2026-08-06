import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const testPath = 'scripts/test-linked-workshops-pglite.mjs';
const testSource = readFileSync(testPath, 'utf8');
const before = `        status, participant_audience, collect_participant_age, workshop_type,
        requires_followup_session, followup_workshop_id,
        followup_workshop_type, followup_min_days, followup_max_days
      )
      select category.id, 'Glina do Wina test', 'glina-do-wina-test', 18,
        120, 10, 10000, 'PLN', 'scheduled', 'published', 'adult', false,
        'glina-do-wina', true, followup.id, 'szkliwienie', 5, 45`;
const after = `        status, participant_audience, collect_participant_age, workshop_type,
        offers_followup_session, requires_followup_session, followup_workshop_id,
        followup_workshop_type, followup_min_days, followup_max_days
      )
      select category.id, 'Glina do Wina test', 'glina-do-wina-test', 18,
        120, 10, 10000, 'PLN', 'scheduled', 'published', 'adult', false,
        'glina-do-wina', true, true, followup.id, 'szkliwienie', 5, 45`;
if (!testSource.includes(before)) {
  throw new Error('Optional follow-up fixture anchor not found');
}
writeFileSync(testPath, testSource.replace(before, after));

writeFileSync(
  '.github/workflows/voucher-validation.yml',
  `name: Booking validation

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Node
        uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Audit production dependencies
        run: npm audit --omit=dev --audit-level=high

      - name: Typecheck
        run: npm run typecheck -- --pretty false

      - name: Migration harness
        run: npm run test:migrations

      - name: Voucher lifecycle integration
        run: npm run test:vouchers:pglite

      - name: Linked workshop lifecycle integration
        run: npm run test:linked-workshops:pglite

      - name: Unit tests
        run: npm test

      - name: Production build
        env:
          NEXT_PUBLIC_SITE_URL: https://example.invalid
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: test-anon-key
          SUPABASE_SECRET_KEY: test-secret-key
          PAYMENTS_PROVIDER: manual
        run: npm run build
`
);

unlinkSync('scripts/apply-optional-followup-hotfix.mjs');
