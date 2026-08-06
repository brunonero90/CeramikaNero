import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/00000000000022_voucher_refund_compatibility.sql'
  ),
  'utf8'
);

describe('voucher-only refund migration contract', () => {
  it('normalizes the voucher payment to zero cash due', () => {
    expect(migration).toContain(
      'create or replace function public.normalize_voucher_only_payment'
    );
    expect(migration).toContain("new.selected_payment_method = 'voucher'");
    expect(migration).toContain('set amount_gross_grosz = 0');
  });

  it('uses the existing idempotent order resource release path', () => {
    expect(migration).toContain(
      'create or replace function public.refund_voucher_only_order'
    );
    expect(migration).toContain('public.release_refunded_order_resources');
    expect(migration).toContain("event_type = 'voucher_refund_completed'");
  });
});
