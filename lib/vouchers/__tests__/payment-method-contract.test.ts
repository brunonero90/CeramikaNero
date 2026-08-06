import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/00000000000023_voucher_payment_method_constraint.sql'
  ),
  'utf8'
);

describe('voucher payment method migration contract', () => {
  it('extends the existing order payment method constraint', () => {
    expect(migration).toContain('orders_selected_payment_method_check');
    expect(migration).toContain(
      "selected_payment_method in ('stripe', 'bank_transfer', 'voucher')"
    );
  });
});
