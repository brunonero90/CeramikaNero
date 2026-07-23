import { createClient } from '@/lib/supabase/server';
import { mapCategory } from '@/lib/database/mappers';
import type { WorkshopCategory } from '@/lib/database/types';

export async function getAll(): Promise<WorkshopCategory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workshop_categories')
    .select('*')
    .eq('is_visible', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

export async function getBySlug(
  slug: string
): Promise<WorkshopCategory | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workshop_categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return mapCategory(data);
}
