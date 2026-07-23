import { fileTypeFromBuffer } from 'file-type';
import { imageSize } from 'image-size';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';

export const ALLOWED_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
];

export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

export function sanitizeFilename(name: string): string {
  return name
    .replace(FORBIDDEN_FILENAME_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function generateStoragePath(filename: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const safeName = sanitizeFilename(filename);
  return `originals/${year}/${month}/${uuid}/${safeName}`;
}

export type MediaValidationResult =
  | {
      ok: true;
      buffer: Buffer;
      mimeType: string;
      width: number;
      height: number;
    }
  | { ok: false; error: string };

export async function validateUploadedFile(
  file: File
): Promise<MediaValidationResult> {
  if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
    return { ok: false, error: `Plik przekracza maksymalny rozmiar 10 MB.` };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    return { ok: false, error: 'Przesłany plik jest pusty.' };
  }

  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !ALLOWED_MEDIA_TYPES.includes(fileType.mime)) {
    return {
      ok: false,
      error: 'Niedozwolony format pliku. Akceptowane są JPG, PNG, WebP i AVIF.',
    };
  }

  const dimensions = imageSize(buffer);
  if (!dimensions.width || !dimensions.height) {
    return { ok: false, error: 'Nie udało się odczytać wymiarów obrazu.' };
  }

  return {
    ok: true,
    buffer,
    mimeType: fileType.mime,
    width: dimensions.width,
    height: dimensions.height,
  };
}

export async function uploadMediaToStorage(
  supabase: SupabaseClient<Database>,
  { buffer, path, mimeType }: { buffer: Buffer; path: string; mimeType: string }
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from('media').upload(path, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl };
}
