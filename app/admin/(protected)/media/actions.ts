'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import {
  validateUploadedFile,
  generateStoragePath,
  uploadMediaToStorage,
} from '@/lib/admin/media';
import { mapMediaAsset } from '@/lib/database/mappers';
import type { MediaAsset } from '@/lib/database/types';

export type MediaUploadActionState =
  | { ok: true; message: string; asset: MediaAsset }
  | { ok: false; error: string; field?: string };

export async function uploadMediaAction(
  _prevState: MediaUploadActionState | undefined,
  formData: FormData
): Promise<MediaUploadActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const file = formData.get('file') as File | null;
  const altText = formData.get('altText')?.toString() ?? '';

  if (!file || file.size === 0) {
    return { ok: false, error: 'Wybierz plik do przesłania.', field: 'file' };
  }

  if (!altText.trim()) {
    return { ok: false, error: 'Podaj tekst alternatywny.', field: 'altText' };
  }

  const validation = await validateUploadedFile(file);
  if (!validation.ok) {
    return { ok: false, error: validation.error, field: 'file' };
  }

  const path = generateStoragePath(file.name);
  const upload = await uploadMediaToStorage(supabase, {
    buffer: validation.buffer,
    path,
    mimeType: validation.mimeType,
  });

  if (!upload.ok) {
    return { ok: false, error: upload.error, field: 'file' };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('media_assets')
    .insert({
      original_filename: file.name,
      storage_bucket: 'media',
      storage_path: path,
      mime_type: validation.mimeType,
      width: validation.width,
      height: validation.height,
      file_size_bytes: validation.buffer.length,
      alt_text: altText,
      source: 'upload',
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: 'Nie udało się zapisać metadanych pliku.',
      field: 'file',
    };
  }

  const asset = mapMediaAsset(inserted);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'upload_media',
    entityType: 'media_asset',
    entityId: inserted.id,
    summary: `Uploaded media ${file.name}`,
    changedFields: {
      original_filename: file.name,
      mime_type: validation.mimeType,
      width: validation.width,
      height: validation.height,
    },
  });

  revalidatePath('/admin/media');
  return { ok: true, message: 'Plik został przesłany.', asset };
}

export async function archiveMediaAction(id: string): Promise<void> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  await supabase
    .from('media_assets')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'archive_media',
    entityType: 'media_asset',
    entityId: id,
    summary: 'Archived media asset',
  });

  revalidatePath('/admin/media');
}
