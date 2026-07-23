import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete (process.env as { NODE_ENV?: string }).NODE_ENV;
}

function setNodeEnv(value: string) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = value;
}

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: () => {},
  }),
}));

describe('adapter selection', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('selects fixtures in development without Supabase env', async () => {
    setNodeEnv('development');
    const { getAdapterName } = await import('../factory');
    expect(getAdapterName()).toBe('fixtures');
  });

  it('selects supabase in development with Supabase env', async () => {
    setNodeEnv('development');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    const { getAdapterName } = await import('../factory');
    expect(getAdapterName()).toBe('supabase');
  });

  it('selects supabase in production regardless of env presence', async () => {
    setNodeEnv('production');
    const { getAdapterName } = await import('../factory');
    expect(getAdapterName()).toBe('supabase');
  });
});
