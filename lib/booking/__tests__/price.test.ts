import { describe, it, expect } from 'vitest';
import { formatPrice, groszFromPln, plnFromGrosz } from '@/lib/utils/price';

describe('price helpers', () => {
  it('formats grosz as PLN with two decimals', () => {
    expect(formatPrice(10000)).toBe('100.00 PLN');
    expect(formatPrice(1250)).toBe('12.50 PLN');
    expect(formatPrice(0)).toBe('0.00 PLN');
  });

  it('converts PLN to grosz', () => {
    expect(groszFromPln(100)).toBe(10000);
    expect(groszFromPln(12.5)).toBe(1250);
  });

  it('converts grosz to PLN', () => {
    expect(plnFromGrosz(10000)).toBe(100);
    expect(plnFromGrosz(1250)).toBe(12.5);
  });
});
