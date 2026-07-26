import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('privacy / token boundaries (source)', () => {
  it('order status lookup hashes tokens and rejects short input', () => {
    const src = readFileSync(
      join(process.cwd(), 'lib/cart/order-status.ts'),
      'utf8'
    );
    expect(src).toContain('createHash');
    expect(src).toContain('sha256');
    expect(src).toContain('public_lookup_token_hash');
    expect(src).toMatch(/\[a-f0-9\]\{32,128\}/);
    expect(src).not.toContain('console.log(token');
  });

  it('enquiry and order tables have RLS deny-public policies in migration 13/11', () => {
    const m13 = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/00000000000013_enquiries_and_order_email_types.sql'
      ),
      'utf8'
    );
    expect(m13).toContain('enable row level security');
    expect(m13).toMatch(/enquiries/i);

    const m11 = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/00000000000011_cart_orders_products.sql'
      ),
      'utf8'
    );
    expect(m11).toContain('enable row level security');
    expect(m11).toContain('orders');
    expect(m11).toContain('order_emails');
  });
});
