import { galleryItems } from './data';
import type { GalleryItem } from '@/lib/database/types';

export async function getVisible(): Promise<GalleryItem[]> {
  return galleryItems
    .filter((item) => item.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getAll(): Promise<GalleryItem[]> {
  return galleryItems.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<GalleryItem | null> {
  const item = galleryItems.find((i) => i.id === slug);
  if (!item) return null;
  if (!includeUnpublished && !item.isVisible) return null;
  return item;
}
