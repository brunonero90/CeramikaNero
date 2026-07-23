import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isFixtureMode,
  assertNotFixtureModeInProduction,
} from '../fixture-mode';

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

describe('fixture mode detection', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is enabled in development when Supabase public env is missing', () => {
    setNodeEnv('development');
    expect(isFixtureMode()).toBe(true);
  });

  it('is disabled in production even when env is missing', () => {
    setNodeEnv('production');
    expect(isFixtureMode()).toBe(false);
  });

  it('is disabled when Supabase public env is present', () => {
    setNodeEnv('development');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    expect(isFixtureMode()).toBe(false);
  });

  it('throws in production when env is missing', () => {
    setNodeEnv('production');
    expect(() => assertNotFixtureModeInProduction()).toThrow(
      'Production cannot use fixture mode'
    );
  });
});
