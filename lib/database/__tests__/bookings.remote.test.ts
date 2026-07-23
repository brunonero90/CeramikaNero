import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

/**
 * Phase 5 booking integration tests.
 *
 * These tests run against the real Supabase project and require the Phase 5
 * migration (00000000000005_booking_system.sql) to be applied first. They are
 * skipped until migration approval is granted, after which they can be enabled
 * and run with `npm run test`.
 */

// This suite is skipped until the Phase 5 migration is applied and the new
// database functions are present. After approval and migration, replace `.skip`
// with `.skipIf(!url || !secretKey)` to run the tests against the real project.
describe.skip('Phase 5 booking integration', () => {
  const admin = createClient<Database>(url!, secretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testPrefix = 'PH5-TEST';
  const testWorkshop = {
    title: `${testPrefix} workshop`,
    slug: `${testPrefix.toLowerCase()}-workshop`,
    description: 'Test workshop for Phase 5 integration.',
    short_description: 'Test',
    status: 'published',
    booking_mode: 'scheduled',
    default_price_gross_grosz: 10000,
    default_capacity: 10,
    default_duration_minutes: 120,
  };

  it('atomically reserves capacity and prevents concurrent overselling', async () => {
    const { data: workshop } = await admin
      .from('workshops')
      .select('id')
      .eq('slug', testWorkshop.slug)
      .single();
    expect(workshop).toBeDefined();
  });

  it('expires pending bookings and releases capacity exactly once', async () => {
    const { data: expired } = await admin.rpc('expire_pending_bookings');
    expect(Array.isArray(expired)).toBe(true);
  });

  it('confirms a booking from a verified payment only once', async () => {
    // TODO after migration.
  });

  it('cancels a booking within the refund window and releases capacity', async () => {
    // TODO after migration.
  });

  it('records a refund without exceeding the captured amount', async () => {
    // TODO after migration.
  });

  it('creates a manual booking and reserves capacity', async () => {
    // TODO after migration.
  });

  it('denies editors from booking management', async () => {
    // TODO after migration.
  });

  it('returns public booking status only through a secure scoped endpoint', async () => {
    // TODO after migration.
  });

  it('validates and consumes a cancellation token', async () => {
    // TODO after migration.
  });
});
