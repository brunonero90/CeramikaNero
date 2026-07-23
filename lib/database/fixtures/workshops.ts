import { categories, workshops, sessions, instructors } from './data';
import type {
  Workshop,
  WorkshopWithCategory,
  WorkshopWithSessions,
} from '@/lib/database/types';

function withCategory(workshop: Workshop): WorkshopWithCategory {
  const category = categories.find((c) => c.id === workshop.categoryId) ?? null;
  return { ...workshop, category };
}

function isPublic(workshop: Workshop): boolean {
  return workshop.status === 'published' && workshop.archivedAt === null;
}

export async function getAll(): Promise<WorkshopWithCategory[]> {
  return workshops
    .filter(isPublic)
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'))
    .map(withCategory);
}

export async function getByCategorySlug(
  slug: string
): Promise<WorkshopWithCategory[]> {
  const category = categories.find((c) => c.slug === slug);
  if (!category) return [];

  return workshops
    .filter(
      (workshop) => workshop.categoryId === category.id && isPublic(workshop)
    )
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'))
    .map(withCategory);
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<WorkshopWithSessions | null> {
  const workshop = workshops.find(
    (w) => w.slug === slug && (includeUnpublished || isPublic(w))
  );
  if (!workshop) return null;

  const workshopSessions = sessions
    .filter(
      (session) =>
        session.workshopId === workshop.id &&
        (includeUnpublished ||
          session.status === 'scheduled' ||
          session.status === 'sold_out')
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const workshopInstructors = instructors
    .filter((instructor) => instructor.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    ...withCategory(workshop),
    sessions: workshopSessions,
    instructors: workshopInstructors,
    media: [],
  };
}

export async function getFeatured(): Promise<WorkshopWithCategory[]> {
  return workshops
    .filter((workshop) => workshop.isFeatured && isPublic(workshop))
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'))
    .map(withCategory);
}
