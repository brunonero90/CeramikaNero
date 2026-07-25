import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Untyped admin client for cart/order tables until `npm run db:types`
 * is regenerated against migrations 11–12.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCartAdminClient(): any {
  return createAdminClient();
}
