import { describe, it, expect } from 'vitest';
import { formatWarsawDateTime, hoursBeforeSession } from '@/lib/utils/datetime';

describe('datetime helpers', () => {
  it('renders a Warsaw-aware timestamp', () => {
    const warsawWinter = '2026-01-15T18:00:00+00:00';
    const formatted = formatWarsawDateTime(warsawWinter);
    expect(formatted).toContain('2026');
    expect(formatted).toContain('19:00'); // UTC -> CET is +1
  });

  it('renders a Warsaw-aware summer timestamp with DST', () => {
    const warsawSummer = '2026-07-15T17:00:00+00:00';
    const formatted = formatWarsawDateTime(warsawSummer);
    expect(formatted).toContain('19:00'); // UTC -> CEST is +2
  });

  it('calculates hours before a session', () => {
    const inTwoDays = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    expect(hoursBeforeSession(inTwoDays)).toBeGreaterThan(47);
    expect(hoursBeforeSession(inTwoDays)).toBeLessThan(49);

    const inTwelveHours = new Date(
      Date.now() + 12 * 60 * 60 * 1000
    ).toISOString();
    expect(hoursBeforeSession(inTwelveHours)).toBeGreaterThan(11);
    expect(hoursBeforeSession(inTwelveHours)).toBeLessThan(13);
  });
});
