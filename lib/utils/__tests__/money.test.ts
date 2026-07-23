import { describe, expect, it } from 'vitest';
import {
  formatGroszAsPln,
  groszToZloty,
  zlotyToGrosz,
} from '@/lib/utils/money';

describe('money formatting', () => {
  it('formats grosz as PLN with two decimal places', () => {
    expect(formatGroszAsPln(18000)).toBe('180,00 zł');
    expect(formatGroszAsPln(22000)).toBe('220,00 zł');
  });

  it('formats zero grosz', () => {
    expect(formatGroszAsPln(0)).toBe('0,00 zł');
  });

  it('formats single grosz', () => {
    expect(formatGroszAsPln(1)).toBe('0,01 zł');
  });

  it('converts grosz to zloty string', () => {
    expect(groszToZloty(18000)).toBe('180.00');
  });

  it('converts zloty string to grosz', () => {
    expect(zlotyToGrosz('123.45')).toBe(12345);
  });

  it('rejects non-integer grosz', () => {
    expect(() => formatGroszAsPln(100.5)).toThrow();
  });
});
