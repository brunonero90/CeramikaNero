'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { workshopInputSchema } from '@/lib/admin/schemas';
import {
  normaliseSlugInput,
  slugifyTitle,
  isReservedSlug,
} from '@/lib/admin/slugs';

export type WorkshopActionState =
  | { ok: true; id: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const str = value?.toString() ?? '';
  if (str === '') return null;
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

function parseJsonArray(value: FormDataEntryValue | null): unknown[] {
  const str = value?.toString() ?? '[]';
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function validateWorkshopForm(
  supabase: ReturnType<typeof createClient>,
  formData: FormData,
  excludeId?: string
): Promise<
  | { ok: true; data: z.infer<typeof workshopInputSchema> }
  | { ok: false; errors: Record<string, string>; formError?: string }
> {
  const title = formData.get('title')?.toString() ?? '';
  let slug = normaliseSlugInput(formData.get('slug')?.toString() ?? '');
  if (!slug && title) slug = slugifyTitle(title);

  if (isReservedSlug(slug)) {
    return { ok: false, errors: { slug: 'Ten slug jest zarezerwowany.' } };
  }

  const { data: existing } = await supabase
    .from('workshops')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing && existing.id !== excludeId) {
    return { ok: false, errors: { slug: 'Ten slug jest już używany.' } };
  }

  const parsed = workshopInputSchema.safeParse({
    categoryId: formData.get('categoryId'),
    title,
    slug,
    shortDescription: formData.get('shortDescription') || null,
    description: formData.get('description') || null,
    practicalInformation: formData.get('practicalInformation') || null,
    minimumAge: numberOrNull(formData.get('minimumAge')),
    maximumAge: numberOrNull(formData.get('maximumAge')),
    defaultDurationMinutes: Number(formData.get('defaultDurationMinutes') || 0),
    defaultCapacity: Number(formData.get('defaultCapacity') || 0),
    defaultPriceGrossPln: Number(formData.get('defaultPriceGrossPln') || 0),
    suggestedTheme: formData.get('suggestedTheme') || null,
    bookingMode: formData.get('bookingMode'),
    externalBookingUrl: formData.get('externalBookingUrl') || null,
    status: formData.get('status'),
    isFeatured: formData.get('isFeatured') === 'on',
    seoTitle: formData.get('seoTitle') || null,
    seoDescription: formData.get('seoDescription') || null,
    featuredMediaId: formData.get('featuredMediaId') || null,
    instructorIds: parseJsonArray(formData.get('instructorIds')),
    galleryMedia: parseJsonArray(formData.get('galleryMedia')),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  const { data: category } = await supabase
    .from('workshop_categories')
    .select('id')
    .eq('id', data.categoryId)
    .maybeSingle();
  if (!category) {
    return { ok: false, errors: { categoryId: 'Kategoria nie istnieje.' } };
  }

  for (const instructorId of data.instructorIds) {
    const { data: instructor } = await supabase
      .from('instructors')
      .select('id')
      .eq('id', instructorId)
      .maybeSingle();
    if (!instructor) {
      return {
        ok: false,
        errors: { instructorIds: 'Jeden z instruktorów nie istnieje.' },
      };
    }
  }

  for (const item of data.galleryMedia) {
    const { data: media } = await supabase
      .from('media_assets')
      .select('id')
      .eq('id', item.mediaAssetId)
      .maybeSingle();
    if (!media) {
      return {
        ok: false,
        errors: { galleryMedia: 'Jeden z plików galerii nie istnieje.' },
      };
    }
  }

  return { ok: true, data };
}

export async function createWorkshopAction(
  _prevState: WorkshopActionState | undefined,
  formData: FormData
): Promise<WorkshopActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const validated = await validateWorkshopForm(supabase, formData);
  if (!validated.ok) {
    return validated;
  }
  const data = validated.data;

  const { data: workshopId, error } = await supabase.rpc(
    'upsert_workshop_with_relations',
    {
      p_workshop_id: null,
      p_category_id: data.categoryId,
      p_title: data.title,
      p_slug: data.slug,
      p_short_description: data.shortDescription,
      p_description: data.description,
      p_practical_information: data.practicalInformation,
      p_minimum_age: data.minimumAge,
      p_maximum_age: data.maximumAge,
      p_default_duration_minutes: data.defaultDurationMinutes,
      p_default_capacity: data.defaultCapacity,
      p_default_price_gross_grosz: data.defaultPriceGrossPln,
      p_suggested_theme: data.suggestedTheme,
      p_featured_media_id: data.featuredMediaId,
      p_booking_mode: data.bookingMode,
      p_external_booking_url: data.externalBookingUrl,
      p_status: data.status,
      p_is_featured: data.isFeatured,
      p_seo_title: data.seoTitle,
      p_seo_description: data.seoDescription,
      p_instructor_ids: data.instructorIds,
      p_gallery_media: data.galleryMedia as unknown,
    }
  );

  if (error || !workshopId) {
    return {
      ok: false,
      formError: 'Nie udało się zapisać warsztatu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_workshop',
    entityType: 'workshop',
    entityId: workshopId,
    summary: `Created workshop ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/warsztaty');
  revalidatePath('/warsztaty');
  revalidatePath(`/warsztaty/${data.slug}`);
  return { ok: true, id: workshopId, message: 'Warsztat został utworzony.' };
}

export async function updateWorkshopAction(
  id: string,
  _prevState: WorkshopActionState | undefined,
  formData: FormData
): Promise<WorkshopActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('workshops')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, formError: 'Warsztat nie istnieje.', errors: {} };
  }

  const validated = await validateWorkshopForm(supabase, formData, id);
  if (!validated.ok) {
    return validated;
  }
  const data = validated.data;

  const { data: workshopId, error } = await supabase.rpc(
    'upsert_workshop_with_relations',
    {
      p_workshop_id: id,
      p_category_id: data.categoryId,
      p_title: data.title,
      p_slug: data.slug,
      p_short_description: data.shortDescription,
      p_description: data.description,
      p_practical_information: data.practicalInformation,
      p_minimum_age: data.minimumAge,
      p_maximum_age: data.maximumAge,
      p_default_duration_minutes: data.defaultDurationMinutes,
      p_default_capacity: data.defaultCapacity,
      p_default_price_gross_grosz: data.defaultPriceGrossPln,
      p_suggested_theme: data.suggestedTheme,
      p_featured_media_id: data.featuredMediaId,
      p_booking_mode: data.bookingMode,
      p_external_booking_url: data.externalBookingUrl,
      p_status: data.status,
      p_is_featured: data.isFeatured,
      p_seo_title: data.seoTitle,
      p_seo_description: data.seoDescription,
      p_instructor_ids: data.instructorIds,
      p_gallery_media: data.galleryMedia as unknown,
    }
  );

  if (error || !workshopId) {
    return {
      ok: false,
      formError: 'Nie udało się zaktualizować warsztatu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_workshop',
    entityType: 'workshop',
    entityId: id,
    summary: `Updated workshop ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/warsztaty');
  revalidatePath('/warsztaty');
  revalidatePath(`/warsztaty/${data.slug}`);
  return {
    ok: true,
    id: workshopId,
    message: 'Warsztat został zaktualizowany.',
  };
}

export async function changeWorkshopStatusAction(
  id: string,
  status: 'draft' | 'published' | 'archived'
): Promise<WorkshopActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const update: {
    status: string;
    archived_at?: string | null;
  } = { status };
  if (status === 'archived') {
    update.archived_at = new Date().toISOString();
  } else {
    update.archived_at = null;
  }

  const { error } = await supabase
    .from('workshops')
    .update(update)
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zmienić statusu warsztatu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: `workshop_status_${status}`,
    entityType: 'workshop',
    entityId: id,
    summary: `Changed workshop status to ${status}`,
    changedFields: { status },
  });

  revalidatePath('/admin/warsztaty');
  revalidatePath('/warsztaty');
  return { ok: true, id, message: 'Status warsztatu został zmieniony.' };
}
