import { blogPosts } from './data';
import type { BlogPost } from '@/lib/database/types';

function isPublishedNow(post: BlogPost): boolean {
  if (!post.publishedAt) return true;
  return new Date(post.publishedAt) <= new Date();
}

export async function getRecent(limit: number): Promise<BlogPost[]> {
  return blogPosts
    .filter(
      (post) =>
        post.status === 'published' &&
        post.archivedAt === null &&
        isPublishedNow(post)
    )
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, limit);
}

export async function getAll(): Promise<BlogPost[]> {
  return blogPosts
    .filter(
      (post) =>
        post.status === 'published' &&
        post.archivedAt === null &&
        isPublishedNow(post)
    )
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<BlogPost | null> {
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return null;
  if (
    !includeUnpublished &&
    (post.status !== 'published' ||
      post.archivedAt !== null ||
      !isPublishedNow(post))
  ) {
    return null;
  }
  return post;
}
