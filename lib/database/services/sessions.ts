import { createClient } from '@/lib/supabase/server';
import { mapWorkshopSession } from '@/lib/database/mappers';
import type { WorkshopSession } from '@/lib/database/types';

export async function getUpcomingByWorkshopId(
  workshopId: string
): Promise<WorkshopSession[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workshop_sessions')
    .select('*')
    .eq('workshop_id', workshopId)
    .in('status', ['scheduled', 'sold_out'])
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapWorkshopSession);
}
