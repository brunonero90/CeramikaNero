import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('admin login contract (source)', () => {
  it('login form uses browser sign-in, token finalize and hard navigation', () => {
    const src = readFileSync('app/admin/login/login-form.tsx', 'utf8');
    expect(src).toContain('signInWithPassword');
    expect(src).toContain('finalizeAdminLoginAction');
    expect(src).toContain('access_token');
    expect(src).toContain('refresh_token');
    expect(src).toContain('window.location.assign');
    expect(src).toMatch(/Nieprawidłowy email lub hasło/);
  });

  it('finalize action persists session cookies then checks admin_users', () => {
    const src = readFileSync('app/admin/login/actions.ts', 'utf8');
    expect(src).toContain('setSession');
    expect(src).toContain('admin_users');
    expect(src).toContain('redirectTo');
    expect(src).toMatch(/nie ma aktywnych uprawnień administratora/);
    expect(src).toContain('logoutAction');
  });

  it('public env helper uses static NEXT_PUBLIC property access for client inlining', () => {
    const src = readFileSync('lib/supabase/environment.ts', 'utf8');
    expect(src).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
    expect(src).toContain('process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
    expect(src).not.toMatch(/safeParse\(\s*process\.env\s*\)/);
  });
});
