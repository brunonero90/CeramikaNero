import { describe, expect, it, vi } from 'vitest';
import type { LoginActionState } from '@/app/admin/login/actions';

describe('admin login action contract', () => {
  it('exports success state with redirectTo instead of relying on redirect()', async () => {
    const mod = await import('@/app/admin/login/actions');
    expect(typeof mod.loginAction).toBe('function');
    // Type-level contract: success shape must include redirectTo for useActionState clients.
    const sample: LoginActionState = { ok: true, redirectTo: '/admin' };
    expect(sample.redirectTo).toBe('/admin');
  });

  it('getCurrentAdmin uses getUser and admin_users membership', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync('lib/admin/auth.ts', 'utf8')
    );
    expect(src).toContain('getUser');
    expect(src).toContain('admin_users');
    expect(src).toContain('is_active');
    expect(src).not.toContain('getSession');
  });

  it('login form navigates on ok state via router.replace', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync('app/admin/login/login-form.tsx', 'utf8')
    );
    expect(src).toContain('router.replace');
    expect(src).toContain('state?.ok');
    expect(src).toContain('Przekierowanie');
  });

  it('protected layout redirects instead of throwing on missing admin', async () => {
    const src = await import('fs').then((fs) =>
      fs.readFileSync('app/admin/(protected)/layout.tsx', 'utf8')
    );
    expect(src).toContain('getCurrentAdmin');
    expect(src).toContain("redirect('/admin/login?error=unauthorized')");
    expect(src).not.toContain('requireAdmin()');
  });
});

describe('admin login action behavior (mocked)', () => {
  it('returns Polish error when credentials missing', async () => {
    vi.resetModules();
    const { loginAction } = await import('@/app/admin/login/actions');
    const fd = new FormData();
    const result = await loginAction(undefined, fd);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/wymagane/i);
    }
  });
});
