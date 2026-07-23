import { describe, expect, it } from 'vitest';
import {
  localDateTimeToUtc,
  utcToLocalDateTime,
  isValidTimeFormat,
  isValidDateFormat,
  DEFAULT_ADMIN_TIMEZONE,
} from '../timezones';

describe('localDateTimeToUtc', () => {
  it('converts a normal Europe/Warsaw winter time to UTC', () => {
    const result = localDateTimeToUtc(
      '2026-01-15',
      '14:00',
      DEFAULT_ADMIN_TIMEZONE
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.utc.toISOString()).toBe('2026-01-15T13:00:00.000Z');
    }
  });

  it('converts a normal Europe/Warsaw summer time to UTC', () => {
    const result = localDateTimeToUtc(
      '2026-07-15',
      '14:00',
      DEFAULT_ADMIN_TIMEZONE
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.utc.toISOString()).toBe('2026-07-15T12:00:00.000Z');
    }
  });

  it('rejects a non-existent DST gap time', () => {
    // Europe/Warsaw 2026-03-29 02:30 does not exist (clocks jump 1->2->3)
    const result = localDateTimeToUtc(
      '2026-03-29',
      '02:30',
      DEFAULT_ADMIN_TIMEZONE
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid');
    }
  });

  it('detects ambiguous DST fall-back time', () => {
    // Europe/Warsaw 2026-10-25 02:30 occurs twice
    const result = localDateTimeToUtc(
      '2026-10-25',
      '02:30',
      DEFAULT_ADMIN_TIMEZONE
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('ambiguous');
    }
  });
});

describe('utcToLocalDateTime', () => {
  it('formats a UTC date to Europe/Warsaw date and time', () => {
    const { date, time } = utcToLocalDateTime(
      new Date('2026-01-15T13:00:00.000Z'),
      DEFAULT_ADMIN_TIMEZONE
    );
    expect(date).toBe('2026-01-15');
    expect(time).toBe('14:00');
  });
});

describe('isValidTimeFormat', () => {
  it('accepts valid 24-hour times', () => {
    expect(isValidTimeFormat('00:00')).toBe(true);
    expect(isValidTimeFormat('23:59')).toBe(true);
  });

  it('rejects invalid times', () => {
    expect(isValidTimeFormat('24:00')).toBe(false);
    expect(isValidTimeFormat('12:60')).toBe(false);
    expect(isValidTimeFormat('noon')).toBe(false);
  });
});

describe('isValidDateFormat', () => {
  it('accepts valid ISO dates', () => {
    expect(isValidDateFormat('2026-01-15')).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isValidDateFormat('2026-02-30')).toBe(false);
    expect(isValidDateFormat('15-01-2026')).toBe(false);
  });
});
