import type { MediaAsset } from '@/lib/database/types';

/**
 * Resolve a public URL for a media asset.
 *
 * Assets stored in the local `public/` bucket are served directly from the
 * root path. Assets stored in Supabase Storage use the configured public URL.
 */
export function getMediaUrl(
  asset: MediaAsset | null | undefined
): string | null {
  if (!asset) return null;
  if (asset.storageBucket === 'public') {
    return `/${asset.storagePath}`;
  }
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${asset.storageBucket}`
    : '';
  if (!baseUrl) return null;
  return `${baseUrl}/${asset.storagePath}`;
}
