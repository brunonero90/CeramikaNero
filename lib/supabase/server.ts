import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database/types';
import { requirePublicEnv } from './environment';

/**
 * Cookie-backed Supabase client for Server Components, Server Actions and
 * Route Handlers. Must be awaited so cookie writes succeed during login.
 */
export async function createClient() {
  const env = requirePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can throw when called from a Server Component that only
            // reads the session. Session refresh happens in proxy.ts.
          }
        },
      },
    }
  );
}
