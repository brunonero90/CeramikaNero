import { describe, expect, it } from 'vitest';
import { legacyRedirectSchema } from '@/lib/database/schema';

describe('redirect validation', () => {
  it('accepts a valid 301 redirect', () => {
    const result = legacyRedirectSchema.safeParse({
      sourcePath: '/old',
      destinationPath: '/new',
      statusCode: 301,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid 308 redirect', () => {
    const result = legacyRedirectSchema.safeParse({
      sourcePath: '/old',
      destinationPath: '/new',
      statusCode: 308,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a redirect loop', () => {
    const result = legacyRedirectSchema.safeParse({
      sourcePath: '/same',
      destinationPath: '/same',
      statusCode: 301,
    });
    expect(result.success).toBe(false);
  });

  it('rejects unsupported status codes', () => {
    const result = legacyRedirectSchema.safeParse({
      sourcePath: '/old',
      destinationPath: '/new',
      statusCode: 302,
    });
    expect(result.success).toBe(false);
  });
});
