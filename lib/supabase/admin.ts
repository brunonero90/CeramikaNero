import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';
import { requireServerEnv } from './environment';

/**
 * Server-only administrative client using the secret key. This client
 * bypasses RLS and must never be imported into client components or exposed in
 * any API response.
 */
export function createAdminClient() {
  const env = requireServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
