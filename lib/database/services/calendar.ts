import { createClient } from '@/lib/supabase/server';
import { mapWorkshopSession } from '@/lib/database/mappers';
import type { WorkshopSession } from '@/lib/database/types';
import { isBookingLocalMode } from '@/lib/booking/local-mode';

export type CalendarSession = WorkshopSession & {
  workshopTitle: string;
  workshopSlug: string;
};

/**
 * Published, bookable future sessions for the public calendar.
 * Excludes draft/cancelled/completed and past starts (Europe/Warsaw via UTC compare).
 *
 * When BOOKING_LOCAL_MODE=1, reads from the file-backed local store and never
 * queries production Supabase.
 */
export async function getPublicCalendarSessions(): Promise<CalendarSession[]> {
  if (isBookingLocalMode()) {
    const [{ ensureLocalBookingSeed }, { listLocalSessions }] =
      await Promise.all([
        import('@/lib/booking/local-seed'),
        import('@/lib/booking/local-store'),
      ]);
    await ensureLocalBookingSeed();
    const local = await listLocalSessions();
    return local.map((s) => ({
      id: s.id,
      workshopId: s.workshopId,
      instructorId: null,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      timezone: s.timezone,
      capacity: s.capacity,
      reservedCount: s.reservedCount,
      priceGrossGrosz: s.priceGrossGrosz,
      currency: s.currency,
      status: s.status,
      locationName: s.locationName,
      locationAddress: s.locationAddress,
      bookingOpensAt: null,
      bookingClosesAt: null,
      externalBookingUrl: null,
      workshopTitle: s.workshopTitle,
      workshopSlug: s.workshopSlug,
    }));
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('workshop_sessions')
    .select(
      `
      *,
      workshops!inner (
        title,
        slug,
        status,
        archived_at
      )
    `
    )
    .in('status', ['scheduled', 'sold_out'])
    .gte('starts_at', now)
    .eq('workshops.status', 'published')
    .is('workshops.archived_at', null)
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('[calendar] query failed', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const workshop = row.workshops as {
      title: string;
      slug: string;
      status: string;
      archived_at: string | null;
    };
    const session = mapWorkshopSession(row);
    return {
      ...session,
      workshopTitle: workshop.title,
      workshopSlug: workshop.slug,
    };
  });
}
