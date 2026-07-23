'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { galleryItemInputSchema } from '@/lib/admin/schemas';

export type GalleryItemActionState =
  | { ok: true; id: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

async function validateGalleryItemForm(
  supabase: ReturnType<typeof createClient>,
  formData: FormData,
  excludeId?: string
): Promise<
  | { ok: true; data: z.infer<typeof galleryItemInputSchema> }
  | { ok: false; errors: Record<string, string>; formError?: string }
> {
  const parsed = galleryItemInputSchema.safeParse({
    mediaAssetId: formData.get('mediaAssetId'),
    title: formData.get('title') || null,
    description: formData.get('description') || null,
    category: formData.get('category') || null,
    displayOrder: Number(formData.get('displayOrder') || 0),
    isVisible: formData.get('isVisible') === 'on',
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  const { data: media } = await supabase
    .from('media_assets')
    .select('id, alt_text, archived_at')
    .eq('id', data.mediaAssetId)
    .maybeSingle();
  if (!media) {
    return { ok: false, errors: { mediaAssetId: 'Plik nie istnieje.' } };
  }
  if (media.archived_at) {
    return {
      ok: false,
      errors: { mediaAssetId: 'Zarchiwizowany plik nie może być użyty.' },
    };
  }
  if (data.isVisible && !media.alt_text.trim()) {
    return {
      ok: false,
      errors: {
        mediaAssetId: 'Widoczny element wymaga tekstu alternatywnego.',
      },
    };
  }

  const { data: duplicate } = await supabase
    .from('gallery_items')
    .select('id')
    .eq('media_asset_id', data.mediaAssetId)
    .neq('id', excludeId ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();
  if (duplicate) {
    return {
      ok: false,
      errors: { mediaAssetId: 'Ten plik jest już w galerii.' },
    };
  }

  return { ok: true, data };
}

export async function createGalleryItemAction(
  _prevState: GalleryItemActionState | undefined,
  formData: FormData
): Promise<GalleryItemActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const validated = await validateGalleryItemForm(supabase, formData);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { data: inserted, error } = await supabase
    .from('gallery_items')
    .insert({
      media_asset_id: data.mediaAssetId,
      title: data.title,
      description: data.description,
      category: data.category,
      display_order: data.displayOrder,
      is_visible: data.isVisible,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: 'Nie udało się dodać elementu galerii.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_gallery_item',
    entityType: 'gallery_item',
    entityId: inserted.id,
    summary: 'Created gallery item',
    changedFields: {
      media_asset_id: data.mediaAssetId,
      is_visible: data.isVisible,
    },
  });

  revalidatePath('/admin/galeria');
  revalidatePath('/galeria');
  return {
    ok: true,
    id: inserted.id,
    message: 'Element galerii został dodany.',
  };
}

export async function updateGalleryItemAction(
  id: string,
  _prevState: GalleryItemActionState | undefined,
  formData: FormData
): Promise<GalleryItemActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('gallery_items')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, formError: 'Element nie istnieje.', errors: {} };
  }

  const validated = await validateGalleryItemForm(supabase, formData, id);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { error } = await supabase
    .from('gallery_items')
    .update({
      media_asset_id: data.mediaAssetId,
      title: data.title,
      description: data.description,
      category: data.category,
      display_order: data.displayOrder,
      is_visible: data.isVisible,
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zaktualizować elementu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_gallery_item',
    entityType: 'gallery_item',
    entityId: id,
    summary: 'Updated gallery item',
    changedFields: {
      is_visible: data.isVisible,
      display_order: data.displayOrder,
    },
  });

  revalidatePath('/admin/galeria');
  revalidatePath('/galeria');
  return { ok: true, id, message: 'Element galerii został zaktualizowany.' };
}

export async function toggleGalleryItemVisibilityAction(
  formData: FormData
): Promise<void> {
  const id = formData.get('id')?.toString() ?? '';
  const isVisible = formData.get('isVisible') === 'on';
  await changeGalleryItemVisibilityAction(id, isVisible);
}

export async function changeGalleryItemVisibilityAction(
  id: string,
  isVisible: boolean
): Promise<GalleryItemActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  if (isVisible) {
    const { data: item } = await supabase
      .from('gallery_items')
      .select('media_asset_id')
      .eq('id', id)
      .single();
    if (item) {
      const { data: media } = await supabase
        .from('media_assets')
        .select('alt_text')
        .eq('id', item.media_asset_id)
        .single();
      if (!media?.alt_text.trim()) {
        return {
          ok: false,
          formError: 'Widoczny element wymaga tekstu alternatywnego.',
          errors: {},
        };
      }
    }
  }

  const { error } = await supabase
    .from('gallery_items')
    .update({ is_visible: isVisible })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zmienić widoczności.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: isVisible ? 'show_gallery_item' : 'hide_gallery_item',
    entityType: 'gallery_item',
    entityId: id,
    summary: `Changed gallery item visibility to ${isVisible}`,
  });

  revalidatePath('/admin/galeria');
  revalidatePath('/galeria');
  return { ok: true, id, message: 'Widoczność została zmieniona.' };
}
