import { sessions } from './data';
import type { WorkshopSession } from '@/lib/database/types';

export async function getUpcomingByWorkshopId(
  workshopId: string
): Promise<WorkshopSession[]> {
  return sessions
    .filter(
      (session) =>
        session.workshopId === workshopId &&
        (session.status === 'scheduled' || session.status === 'sold_out')
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
