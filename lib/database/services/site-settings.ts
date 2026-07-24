import { createClient } from '@/lib/supabase/server';
import { mapPublicSiteSettings } from '@/lib/database/mappers';

export async function getPublicSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('site_settings').select('*');

  if (error) throw error;
  return mapPublicSiteSettings(data ?? []);
}
