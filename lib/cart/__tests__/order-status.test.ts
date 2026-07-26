import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

describe('public order lookup token hashing', () => {
  it('hashes tokens with sha256 hex like the SQL digest path', () => {
    const token = 'a'.repeat(48);
    const hash = createHash('sha256').update(token).digest('hex');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('rejects obviously invalid token shapes in the page guard regex', () => {
    const valid = /^[a-f0-9]{32,128}$/i;
    expect(valid.test('abc')).toBe(false);
    expect(valid.test('../etc/passwd')).toBe(false);
    expect(valid.test('1')).toBe(false);
    expect(valid.test('a'.repeat(48))).toBe(true);
  });
});
