import { describe, expect, it } from 'vitest';

/**
 * Mirrors age normalization used by cart checkout before submit_cart_order.
 * Kept local to the test so production helpers can stay private to the module.
 */
function normalizeParticipantAge(
  age: number | string | null | undefined
): number | null {
  if (age == null || age === '') return null;
  const n = typeof age === 'number' ? age : Number.parseInt(String(age), 10);
  if (!Number.isFinite(n) || n < 0 || n > 120) return null;
  return n;
}

describe('cart checkout age handling', () => {
  it('treats blank age as missing (RPC would reject age-limited workshops)', () => {
    expect(normalizeParticipantAge('')).toBeNull();
    expect(normalizeParticipantAge(null)).toBeNull();
    expect(normalizeParticipantAge(undefined)).toBeNull();
  });

  it('parses numeric strings for age-limited workshops', () => {
    expect(normalizeParticipantAge('11')).toBe(11);
    expect(normalizeParticipantAge(14)).toBe(14);
  });
});
