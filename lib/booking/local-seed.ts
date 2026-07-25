import 'server-only';
import { randomUUID } from 'node:crypto';
import { workshops } from '@/lib/database/fixtures/data';
import {
  listLocalSessions,
  replaceLocalSessions,
  type LocalSession,
} from './local-store';
import { isBookingLocalMode } from './local-mode';

/** Stable UUIDs so E2E and docs can reference fixed sessions. */
export const LOCAL_TEST_SESSION_IDS = {
  glina: '11111111-1111-4111-8111-111111111111',
  dorosli: '22222222-2222-4222-8222-222222222222',
  rodzina: '33333333-3333-4333-8333-333333333333',
  almostFull: '44444444-4444-4444-8444-444444444444',
} as const;

function isoAt(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function endIso(startIso: string, durationMinutes: number): string {
  return new Date(
    new Date(startIso).getTime() + durationMinutes * 60_000
  ).toISOString();
}

function workshopBySlug(slug: string) {
  const workshop = workshops.find((w) => w.slug === slug);
  if (!workshop) {
    throw new Error(`Local seed missing workshop fixture: ${slug}`);
  }
  return workshop;
}

/**
 * Ensures clearly marked [TEST] sessions exist in the local store.
 * Idempotent: does not wipe bookings; only seeds when the store has no
 * published future sessions.
 */
export async function ensureLocalBookingSeed(): Promise<LocalSession[]> {
  if (!isBookingLocalMode()) {
    return [];
  }

  const existing = await listLocalSessions({ includeUnpublished: true });
  const hasPublishedFuture = existing.some(
    (s) =>
      s.published &&
      s.status !== 'cancelled' &&
      new Date(s.startsAt).getTime() > Date.now()
  );
  if (hasPublishedFuture) {
    return existing;
  }

  const glina = workshopBySlug('glina-do-wina');
  const dorosli = workshopBySlug('ceramika-dla-doroslych');
  const rodzina = workshopBySlug('glina-i-rodzina');

  const now = new Date().toISOString();
  const sessions: LocalSession[] = [
    {
      id: LOCAL_TEST_SESSION_IDS.glina,
      workshopId: glina.id,
      workshopTitle: `[TEST] ${glina.title}`,
      workshopSlug: glina.slug,
      startsAt: isoAt(5, 19, 0),
      endsAt: endIso(isoAt(5, 19, 0), glina.defaultDurationMinutes),
      timezone: 'Europe/Warsaw',
      capacity: 8,
      reservedCount: 2,
      priceGrossGrosz: glina.defaultPriceGrossGrosz,
      currency: 'PLN',
      status: 'scheduled',
      locationName: 'Suchy Las (TEST)',
      locationAddress: 'ul. Podgórna 3, Suchy Las',
      published: true,
      minimumAge: glina.minimumAge,
      maximumAge: glina.maximumAge,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: LOCAL_TEST_SESSION_IDS.dorosli,
      workshopId: dorosli.id,
      workshopTitle: `[TEST] ${dorosli.title}`,
      workshopSlug: dorosli.slug,
      startsAt: isoAt(7, 18, 0),
      endsAt: endIso(isoAt(7, 18, 0), dorosli.defaultDurationMinutes),
      timezone: 'Europe/Warsaw',
      capacity: 10,
      reservedCount: 0,
      priceGrossGrosz: dorosli.defaultPriceGrossGrosz,
      currency: 'PLN',
      status: 'scheduled',
      locationName: 'Suchy Las (TEST)',
      locationAddress: 'ul. Podgórna 3, Suchy Las',
      published: true,
      minimumAge: dorosli.minimumAge,
      maximumAge: dorosli.maximumAge,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: LOCAL_TEST_SESSION_IDS.rodzina,
      workshopId: rodzina.id,
      workshopTitle: `[TEST] ${rodzina.title}`,
      workshopSlug: rodzina.slug,
      startsAt: isoAt(9, 15, 0),
      endsAt: endIso(isoAt(9, 15, 0), rodzina.defaultDurationMinutes),
      timezone: 'Europe/Warsaw',
      capacity: 12,
      reservedCount: 4,
      priceGrossGrosz: rodzina.defaultPriceGrossGrosz,
      currency: 'PLN',
      status: 'scheduled',
      locationName: 'Suchy Las (TEST)',
      locationAddress: 'ul. Podgórna 3, Suchy Las',
      published: true,
      minimumAge: rodzina.minimumAge,
      maximumAge: rodzina.maximumAge,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: LOCAL_TEST_SESSION_IDS.almostFull,
      workshopId: dorosli.id,
      workshopTitle: `[TEST] ${dorosli.title} — prawie pełny`,
      workshopSlug: dorosli.slug,
      startsAt: isoAt(12, 18, 0),
      endsAt: endIso(isoAt(12, 18, 0), dorosli.defaultDurationMinutes),
      timezone: 'Europe/Warsaw',
      capacity: 2,
      reservedCount: 1,
      priceGrossGrosz: dorosli.defaultPriceGrossGrosz,
      currency: 'PLN',
      status: 'scheduled',
      locationName: 'Suchy Las (TEST)',
      locationAddress: 'ul. Podgórna 3, Suchy Las',
      published: true,
      minimumAge: dorosli.minimumAge,
      maximumAge: dorosli.maximumAge,
      createdAt: now,
      updatedAt: now,
    },
  ];

  // Preserve any pre-existing bookings/outbox by only replacing sessions
  // when empty of future published sessions.
  await replaceLocalSessions(sessions);
  return sessions;
}

export function newLocalSessionId(): string {
  return randomUUID();
}
