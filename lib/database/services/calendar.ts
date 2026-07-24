import { createClient } from '@/lib/supabase/server';
import { mapWorkshopSession } from '@/lib/database/mappers';
import type { WorkshopSession } from '@/lib/database/types';

export type CalendarSession = WorkshopSession & {
  workshopTitle: string;
  workshopSlug: string;
};

/**
 * Published, bookable future sessions for the public calendar.
 * Excludes draft/cancelled/completed and past starts (Europe/Warsaw via UTC compare).
 */
export async function getPublicCalendarSessions(): Promise<CalendarSession[]> {
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
