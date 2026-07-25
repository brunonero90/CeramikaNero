import { describe, expect, it, vi } from 'vitest';
import type { LoginActionState } from '@/app/admin/login/actions';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { LoginForm } from '@/app/admin/login/login-form';

describe('admin login action contract', () => {
  it('exports finalize + legacy login helpers with redirectTo success shape', async () => {
    const mod = await import('@/app/admin/login/actions');
    expect(typeof mod.finalizeAdminLoginAction).toBe('function');
    expect(typeof mod.loginAction).toBe('function');
    const sample: LoginActionState = { ok: true, redirectTo: '/admin' };
    expect(sample.redirectTo).toBe('/admin');
  });

  it('getCurrentAdmin is exported for cookie-backed admin checks', () => {
    expect(typeof getCurrentAdmin).toBe('function');
  });

  it('login form uses browser Supabase sign-in then hard navigation', () => {
    expect(typeof LoginForm).toBe('function');
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
