import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Glina do Wina follow-up pricing contract', () => {
  const migration = source(
    'supabase/migrations/00000000000034_glina_followup_uses_session_price.sql'
  );
  const revalidation = source('lib/cart/revalidate.ts');
  const checkoutUi = source('components/clone/checkout-page-client.tsx');
  const checkoutServer = source('lib/cart/checkout.ts');

  it('configures Glina do Wina to charge the selected session price', () => {
    expect(migration).toContain('followup_included_in_price = false');
    expect(migration).toContain("slug in ('glina-do-wina', 'glinadowina')");
  });

  it('uses the selected follow-up session price in checkout totals', () => {
    expect(revalidation).toContain(
      'session.price_gross_grosz ?? target.default_price_gross_grosz'
    );
    expect(revalidation).toContain('includedInPrice: Boolean');
    expect(checkoutUi).toContain('unitPriceHintGrosz: selected.unitPriceGrosz');
    expect(checkoutUi).toContain(
      'sum + line.unitPriceHintGrosz * line.quantity'
    );
    expect(checkoutUi).toContain('lines: expandedLines');
  });

  it('only zeroes a follow-up when server configuration explicitly includes it', () => {
    expect(checkoutServer).toContain(
      'included_followup: Boolean(line.includedFollowup)'
    );
    expect(revalidation).toContain('if (option?.includedInPrice)');
  });
});
