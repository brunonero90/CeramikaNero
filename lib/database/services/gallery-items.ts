import { createClient } from '@/lib/supabase/server';
import { mapGalleryItem } from '@/lib/database/mappers';
import type { GalleryItem } from '@/lib/database/types';

export async function getVisible(): Promise<GalleryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('is_visible', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapGalleryItem);
}

export async function getAll(): Promise<GalleryItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapGalleryItem);
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<GalleryItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('id', slug)
    .single();

  if (error || !data) return null;
  const item = mapGalleryItem(data);
  if (!includeUnpublished && !item.isVisible) return null;
  return item;
}
