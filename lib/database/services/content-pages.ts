import { createClient } from '@/lib/supabase/server';
import { mapContentPage } from '@/lib/database/mappers';
import type { ContentPage } from '@/lib/database/types';

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<ContentPage | null> {
  const supabase = await createClient();
  let query = supabase.from('content_pages').select('*').eq('slug', slug);

  if (!includeUnpublished) {
    query = query.eq('status', 'published').is('archived_at', null);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;
  return mapContentPage(data);
}

export async function getAll(): Promise<ContentPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_pages')
    .select('*')
    .eq('status', 'published')
    .is('archived_at', null)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapContentPage);
}
