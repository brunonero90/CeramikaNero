import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/00000000000021_gift_voucher_integration.sql'
  ),
  'utf8'
);

describe('gift voucher migration contract', () => {
  it('stores only a code hash and masked suffix in the voucher ledger', () => {
    const voucherTable = migration.match(
      /create table if not exists public\.gift_vouchers\s*\(([\s\S]*?)\n\);/i
    )?.[1];

    expect(voucherTable).toBeDefined();
    expect(voucherTable).toContain('code_hash text not null unique');
    expect(voucherTable).toContain('code_last4 text not null');
    expect(voucherTable).not.toMatch(/\braw_code\b/i);
    expect(migration).toContain('public.voucher_code_hash');
    expect(migration).toContain(
      'create table if not exists public.voucher_issue_secrets'
    );
    expect(migration).toContain(
      'revoke all on table public.voucher_issue_secrets'
    );
  });

  it('applies the voucher inside the atomic cart transaction', () => {
    const submitV3 = migration.match(
      /create or replace function public\.submit_cart_order_v3\([\s\S]*?revoke all on function public\.submit_cart_order_v3\(/i
    )?.[0];

    expect(submitV3).toBeDefined();
    expect(submitV3).toMatch(
      /select \* into v_voucher[\s\S]*?from public\.gift_vouchers[\s\S]*?where code_hash = public\.voucher_code_hash\(p_voucher_code\)\s+for update;/i
    );
    expect(submitV3).toContain("p_idempotency_key || ':voucher'");
    expect(submitV3).toContain('voucher_fully_paid');
  });

  it('restores or replaces voucher value through the order lifecycle', () => {
    expect(migration).toContain(
      'create or replace function public.sync_order_voucher_lifecycle'
    );
    expect(migration).toContain(
      "new.status in ('cancelled', 'expired', 'refunded')"
    );
    expect(migration).toContain("v_voucher.refund_policy = 'restore'");
    expect(migration).toContain('voucher_issue_secrets');
  });

  it('keeps provider and redemption audit records', () => {
    expect(migration).toContain(
      'create table if not exists public.voucher_redemptions'
    );
    expect(migration).toContain(
      'create table if not exists public.voucher_provider_logs'
    );
    expect(migration).toContain('idx_voucher_redemptions_active_order');
  });
});
