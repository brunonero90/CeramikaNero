import { parsePublicEnv } from './environment';

/**
 * Fixture mode is allowed automatically in development when Supabase public
 * configuration is absent. It is never allowed silently in production.
 */
export function isFixtureMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return !parsePublicEnv().success;
}

export function assertNotFixtureModeInProduction(): void {
  if (process.env.NODE_ENV === 'production' && !parsePublicEnv().success) {
    throw new Error(
      'Production cannot use fixture mode. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }
}
