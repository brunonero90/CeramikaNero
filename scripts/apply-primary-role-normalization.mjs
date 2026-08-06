import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

function replaceAll(path, before, after) {
  const content = readFileSync(path, 'utf8');
  if (!content.includes(before)) {
    throw new Error(`Missing anchor in ${path}: ${before}`);
  }
  writeFileSync(path, content.replaceAll(before, after));
}

replaceAll(
  'lib/cart/checkout.ts',
  "        link_role: line.linkRole ?? null,",
  "        link_role: line.linkRole ?? 'primary',"
);
replaceAll(
  'lib/cart/checkout.ts',
  ".rpc('submit_cart_order_v5', {",
  ".rpc('submit_cart_order_v6', {"
);
replaceAll(
  'lib/cart/checkout.ts',
  "submit_cart_order_v5 failed",
  "submit_cart_order_v6 failed"
);
replaceAll(
  'scripts/test-linked-workshops-pglite.mjs',
  'public.submit_cart_order_v5(',
  'public.submit_cart_order_v6('
);
replaceAll(
  'lib/cart/__tests__/linked-workshop-ux-contract.test.ts',
  ".rpc('submit_cart_order_v5'",
  ".rpc('submit_cart_order_v6'"
);

writeFileSync(
  'supabase/migrations/00000000000030_linked_checkout_primary_role_normalization.sql',
  `-- Ceramika Nero — normalize missing workshop link roles before checkout.
-- Apply after migration 29.

create or replace function public.submit_cart_order_v6(
  p_idempotency_key text,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_marketing_consent boolean,
  p_terms_accepted_at timestamptz,
  p_privacy_policy_version text,
  p_lines jsonb,
  p_shipping_address jsonb,
  p_source text,
  p_selected_payment_method text,
  p_voucher_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_normalized_lines jsonb := '[]'::jsonb;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be an array';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if v_line->>'type' = 'workshop_session'
       and nullif(v_line->>'link_role', '') is null then
      v_line := jsonb_set(
        v_line,
        '{link_role}',
        to_jsonb('primary'::text),
        true
      );
    end if;
    v_normalized_lines := v_normalized_lines || jsonb_build_array(v_line);
  end loop;

  return public.submit_cart_order_v5(
    p_idempotency_key,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_customer_notes,
    p_marketing_consent,
    p_terms_accepted_at,
    p_privacy_policy_version,
    v_normalized_lines,
    p_shipping_address,
    p_source,
    p_selected_payment_method,
    p_voucher_code
  );
end;
$$;

revoke all on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) to service_role;

comment on function public.submit_cart_order_v6(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) is
  'Normalizes workshop lines without a link role to primary before optional/required linked checkout validation.';
`
);

const docsPath = 'docs/LINKED_WORKSHOPS_AND_REMINDERS.md';
writeFileSync(
  docsPath,
  readFileSync(docsPath, 'utf8') +
    `\nMigration 30 normalizes any workshop line without an explicit link role to \`primary\` before linked-checkout validation. This prevents PostgreSQL NULL comparison semantics from misclassifying a normal one-stage booking as a follow-up.\n`
);

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

unlinkSync('scripts/apply-primary-role-normalization.mjs');
