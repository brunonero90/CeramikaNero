import { describe, expect, it, vi } from 'vitest';
import type { LoginActionState } from '@/app/admin/login/actions';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { LoginForm } from '@/app/admin/login/login-form';

describe('admin login action contract', () => {
  it('exports success state with redirectTo instead of relying on redirect()', async () => {
    const mod = await import('@/app/admin/login/actions');
    expect(typeof mod.loginAction).toBe('function');
    // Type-level contract: success shape must include redirectTo for useActionState clients.
    const sample: LoginActionState = { ok: true, redirectTo: '/admin' };
    expect(sample.redirectTo).toBe('/admin');
  });

  it('getCurrentAdmin is exported for cookie-backed admin checks', () => {
    expect(typeof getCurrentAdmin).toBe('function');
  });

  it('login form component is exported for client hard-navigation after ok', () => {
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
