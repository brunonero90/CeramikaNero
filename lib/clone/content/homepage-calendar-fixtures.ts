/**
 * Local-only fixture sessions for homepage calendar visual fidelity.
 * Clearly marked TEST — never invent real public availability.
 * Used when NODE_ENV=development or FIDELITY_FIXTURES=1.
 */
import type { CalendarSessionCard } from '@/components/calendar/public-event-calendar';

function isoAt(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const HOMEPAGE_CALENDAR_FIXTURE_BANNER =
  'DANE TESTOWE — lokalna walidacja wierności wizualnej (nie są to prawdziwe terminy publiczne)';

export function getHomepageCalendarFixtures(): CalendarSessionCard[] {
  return [
    {
      id: 'fixture-test-glina-1',
      workshopTitle: '[TEST] GLINA DO WINA PIĄTEK',
      workshopSlug: 'glina-do-wina-piatek-19-00-suchy-las',
      startsAt: isoAt(5, 19, 0),
      endsAt: isoAt(5, 21, 0),
      timezone: 'Europe/Warsaw',
      capacity: 8,
      reservedCount: 2,
      priceGrossGrosz: 18900,
      status: 'published',
      locationName: 'Suchy Las (TEST)',
    },
    {
      id: 'fixture-test-dorosli-1',
      workshopTitle: '[TEST] CERAMIKA DLA DOROSŁYCH',
      workshopSlug: 'ceramika-dla-doroslych-pon-czw',
      startsAt: isoAt(7, 18, 0),
      endsAt: isoAt(7, 20, 0),
      timezone: 'Europe/Warsaw',
      capacity: 10,
      reservedCount: 0,
      priceGrossGrosz: 13900,
      status: 'published',
      locationName: 'Suchy Las (TEST)',
    },
    {
      id: 'fixture-test-rodzina-1',
      workshopTitle: '[TEST] GLINA I RODZINA',
      workshopSlug: 'glina-i-rodzina-soboty-15-00',
      startsAt: isoAt(9, 15, 0),
      endsAt: isoAt(9, 17, 0),
      timezone: 'Europe/Warsaw',
      capacity: 12,
      reservedCount: 4,
      priceGrossGrosz: 9500,
      status: 'published',
      locationName: 'Suchy Las (TEST)',
    },
  ];
}

export function shouldUseHomepageCalendarFixtures(): boolean {
  // Never surface TEST fixtures in production unless explicitly requested
  // for local fidelity capture (FIDELITY_FIXTURES=1).
  return process.env.FIDELITY_FIXTURES === '1';
}
