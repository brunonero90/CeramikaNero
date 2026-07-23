import { createClient } from '@/lib/supabase/server';
import { mapBlogPost } from '@/lib/database/mappers';
import type { BlogPost } from '@/lib/database/types';

const publishedNowFilter = `published_at.is.null,published_at.lte.${new Date().toISOString()}`;

export async function getRecent(limit: number): Promise<BlogPost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .is('archived_at', null)
    .or(publishedNowFilter)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapBlogPost);
}

export async function getAll(): Promise<BlogPost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .is('archived_at', null)
    .or(publishedNowFilter)
    .order('published_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapBlogPost);
}

export async function getBySlug(
  slug: string,
  includeUnpublished = false
): Promise<BlogPost | null> {
  const supabase = createClient();
  let query = supabase.from('blog_posts').select('*').eq('slug', slug);

  if (!includeUnpublished) {
    query = query
      .eq('status', 'published')
      .is('archived_at', null)
      .or(publishedNowFilter);
  }

  const { data, error } = await query.single();
  if (error || !data) return null;
  return mapBlogPost(data);
}
