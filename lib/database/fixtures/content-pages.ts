import { contentPages } from './data';
import type { ContentPage } from '@/lib/database/types';

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<ContentPage | null> {
  const page = contentPages.find((p) => p.slug === slug);
  if (!page) return null;
  if (
    !includeUnpublished &&
    (page.status !== 'published' || page.archivedAt !== null)
  ) {
    return null;
  }
  return page;
}

export async function getAll(): Promise<ContentPage[]> {
  return contentPages
    .filter((page) => page.status === 'published' && page.archivedAt === null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
