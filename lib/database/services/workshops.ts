import { createClient } from '@/lib/supabase/server';
import {
  mapCategory,
  mapInstructor,
  mapMediaAsset,
  mapWorkshop,
  mapWorkshopSession,
} from '@/lib/database/mappers';
import type {
  Workshop,
  WorkshopWithCategory,
  WorkshopWithSessions,
} from '@/lib/database/types';

function isPublic(workshop: Workshop): boolean {
  return workshop.status === 'published' && workshop.archivedAt === null;
}

export async function getAll(): Promise<WorkshopWithCategory[]> {
  const supabase = await createClient();
  const { data: workshopRows, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('status', 'published')
    .is('archived_at', null);

  if (error) throw error;

  const categoryIds = [
    ...new Set((workshopRows ?? []).map((workshop) => workshop.category_id)),
  ];
  const { data: categoryRows } = await supabase
    .from('workshop_categories')
    .select('*')
    .in('id', categoryIds);

  const categoryMap = new Map(
    (categoryRows ?? []).map((category) => [category.id, mapCategory(category)])
  );

  return (workshopRows ?? [])
    .map((workshop) => ({
      ...mapWorkshop(workshop),
      category: categoryMap.get(workshop.category_id) ?? null,
    }))
    .filter((workshop) => isPublic(workshop))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
}

export async function getByCategorySlug(
  slug: string
): Promise<WorkshopWithCategory[]> {
  const supabase = await createClient();
  const { data: categoryRow, error: categoryError } = await supabase
    .from('workshop_categories')
    .select('*')
    .eq('slug', slug)
    .single();

  if (categoryError || !categoryRow) return [];

  const { data: workshopRows, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('category_id', categoryRow.id)
    .eq('status', 'published')
    .is('archived_at', null);

  if (error) throw error;

  const category = mapCategory(categoryRow);
  return (workshopRows ?? [])
    .map((workshop) => ({ ...mapWorkshop(workshop), category }))
    .filter((workshop) => isPublic(workshop))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<WorkshopWithSessions | null> {
  const supabase = await createClient();
  let query = supabase.from('workshops').select('*').eq('slug', slug);

  if (!includeUnpublished) {
    query = query.eq('status', 'published').is('archived_at', null);
  }

  const { data: workshopRow, error } = await query.single();

  if (error || !workshopRow) return null;

  const workshop = mapWorkshop(workshopRow);
  if (!includeUnpublished && !isPublic(workshop)) return null;

  const { data: categoryRow } = await supabase
    .from('workshop_categories')
    .select('*')
    .eq('id', workshopRow.category_id)
    .single();

  const sessionStatuses = includeUnpublished
    ? ['draft', 'scheduled', 'sold_out', 'cancelled', 'completed']
    : ['scheduled', 'sold_out'];

  const { data: sessionRows } = await supabase
    .from('workshop_sessions')
    .select('*')
    .eq('workshop_id', workshopRow.id)
    .in('status', sessionStatuses)
    .order('starts_at', { ascending: true });

  const { data: instructorLinkRows } = await supabase
    .from('workshop_instructors')
    .select('instructor_id')
    .eq('workshop_id', workshopRow.id)
    .order('display_order', { ascending: true });

  const instructorIds = [
    ...new Set((instructorLinkRows ?? []).map((row) => row.instructor_id)),
  ];
  const { data: instructorRows } =
    instructorIds.length > 0
      ? await supabase
          .from('instructors')
          .select('*')
          .in('id', instructorIds)
          .eq('is_active', true)
      : { data: [] };

  const { data: mediaLinkRows } = await supabase
    .from('workshop_media')
    .select('media_asset_id')
    .eq('workshop_id', workshopRow.id)
    .order('display_order', { ascending: true });

  const mediaAssetIds = [
    ...new Set((mediaLinkRows ?? []).map((row) => row.media_asset_id)),
  ];
  const { data: mediaRows } =
    mediaAssetIds.length > 0
      ? await supabase
          .from('media_assets')
          .select('*')
          .in('id', mediaAssetIds)
          .is('archived_at', null)
      : { data: [] };

  return {
    ...workshop,
    category: categoryRow ? mapCategory(categoryRow) : null,
    sessions: (sessionRows ?? []).map(mapWorkshopSession),
    instructors: (instructorRows ?? []).map(mapInstructor),
    media: (mediaRows ?? []).map(mapMediaAsset),
  };
}

export async function getFeatured(): Promise<WorkshopWithCategory[]> {
  const supabase = await createClient();
  const { data: workshopRows, error } = await supabase
    .from('workshops')
    .select('*')
    .eq('is_featured', true)
    .eq('status', 'published')
    .is('archived_at', null);

  if (error) throw error;

  const categoryIds = [
    ...new Set((workshopRows ?? []).map((workshop) => workshop.category_id)),
  ];
  const { data: categoryRows } = await supabase
    .from('workshop_categories')
    .select('*')
    .in('id', categoryIds);

  const categoryMap = new Map(
    (categoryRows ?? []).map((category) => [category.id, mapCategory(category)])
  );

  return (workshopRows ?? [])
    .map((workshop) => ({
      ...mapWorkshop(workshop),
      category: categoryMap.get(workshop.category_id) ?? null,
    }))
    .filter((workshop) => isPublic(workshop))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'));
}
