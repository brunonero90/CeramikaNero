import { categories } from './data';
import type { WorkshopCategory } from '@/lib/database/types';

export async function getAll(): Promise<WorkshopCategory[]> {
  return categories
    .filter((category) => category.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getBySlug(
  slug: string
): Promise<WorkshopCategory | null> {
  return categories.find((category) => category.slug === slug) ?? null;
}
