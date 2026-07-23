import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { parsePublicEnv, parseServerEnv } from '../environment';

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
}

describe('environment parsing', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('parses public env when all variables are present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

    const publicEnv = parsePublicEnv();
    expect(publicEnv.success).toBe(true);
    if (publicEnv.success) {
      expect(publicEnv.data.NEXT_PUBLIC_SUPABASE_URL).toBe(
        'https://example.supabase.co'
      );
    }
  });

  it('fails when public URL is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    const publicEnv = parsePublicEnv();
    expect(publicEnv.success).toBe(false);
  });

  it('fails when public publishable key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    const publicEnv = parsePublicEnv();
    expect(publicEnv.success).toBe(false);
  });

  it('validates secret-key env only when required', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    const serverEnv = parseServerEnv();
    expect(serverEnv.success).toBe(false);
  });
});
