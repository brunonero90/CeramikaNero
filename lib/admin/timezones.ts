import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { addHours, subHours } from 'date-fns';

export const DEFAULT_ADMIN_TIMEZONE = 'Europe/Warsaw';

export type LocalDateTimeConversionResult =
  { ok: true; utc: Date } | { ok: false; error: 'invalid' | 'ambiguous' };

export function localDateTimeToUtc(
  date: string,
  time: string,
  timezone: string = DEFAULT_ADMIN_TIMEZONE
): LocalDateTimeConversionResult {
  const localDateTime = `${date}T${time}:00`;
  const utc = fromZonedTime(localDateTime, timezone);
  const formatted = formatInTimeZone(utc, timezone, "yyyy-MM-dd'T'HH:mm:ss");

  if (formatted !== localDateTime) {
    return { ok: false, error: 'invalid' };
  }

  const oneHourBefore = formatInTimeZone(
    subHours(utc, 1),
    timezone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
  const oneHourAfter = formatInTimeZone(
    addHours(utc, 1),
    timezone,
    "yyyy-MM-dd'T'HH:mm:ss"
  );

  if (oneHourBefore === localDateTime || oneHourAfter === localDateTime) {
    return { ok: false, error: 'ambiguous' };
  }

  return { ok: true, utc };
}

export function utcToLocalDateTime(
  utc: Date,
  timezone: string = DEFAULT_ADMIN_TIMEZONE
): { date: string; time: string } {
  const formatted = formatInTimeZone(utc, timezone, "yyyy-MM-dd'T'HH:mm:ss");
  const [date, time] = formatted.split('T');
  return { date, time: time.slice(0, 5) };
}

export function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

export function isValidDateFormat(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}
