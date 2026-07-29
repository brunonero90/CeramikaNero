import { describe, expect, it } from 'vitest';
import { parsePlnToGrosz } from '@/lib/payments/admin-money';

describe('parsePlnToGrosz', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12,3', 1230],
    ['12.34', 1234],
    [' 149,00 ', 14900],
  ])('parses %s without floating-point drift', (input, expected) => {
    expect(parsePlnToGrosz(input)).toBe(expected);
  });

  it.each(['-1', '+1', '1e3', '1.234', 'NaN', 'Infinity', '999999999', ''])(
    'rejects unsafe value %s',
    (input) => {
      expect(parsePlnToGrosz(input)).toBeNull();
    }
  );
});
