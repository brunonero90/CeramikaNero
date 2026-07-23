import { createClient } from '@/lib/supabase/server';
import { mapLegacyRedirect } from '@/lib/database/mappers';
import type { LegacyRedirect } from '@/lib/database/types';

export async function getBySourcePath(
  sourcePath: string
): Promise<LegacyRedirect | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('legacy_redirects')
    .select('*')
    .eq('source_path', sourcePath)
    .single();

  if (error || !data) return null;
  return mapLegacyRedirect(data);
}
