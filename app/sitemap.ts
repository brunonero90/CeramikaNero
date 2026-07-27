import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';
import { shouldDisallowPublicIndexing } from '@/lib/seo/indexing';

const STATIC_ROUTES = [
  '/',
  '/kalendarz',
  '/warsztaty',
  '/dla-dzieci',
  '/dla-doroslych',
  '/grupy-i-firmy',
  '/glinadowina',
  '/urodziny',
  '/panienskie',
  '/galeria',
  '/blog',
  '/kontakt',
  '/pracownia',
  '/home',
  '/regulamin',
  '/polityka-prywatnosci',
] as const;

function publicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Avoid publishing a competing sitemap while ceramikanero.pl is for testing.
  if (shouldDisallowPublicIndexing()) {
    return [];
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://ceramikanero.pl';
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route === '/' ? '' : route}`,
    lastModified: now,
    changeFrequency: route === '/kalendarz' ? 'daily' : 'weekly',
    priority: route === '/' || route === '/kalendarz' ? 1 : 0.7,
  }));

  const supabase = publicClient();
  if (!supabase) return entries;

  try {
    const { data: workshops } = await supabase
      .from('workshops')
      .select('slug, updated_at')
      .eq('status', 'published')
      .is('archived_at', null);

    for (const workshop of workshops ?? []) {
      entries.push({
        url: `${siteUrl}/warsztaty/${workshop.slug}`,
        lastModified: workshop.updated_at ? new Date(workshop.updated_at) : now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .lte('published_at', now.toISOString());

    for (const post of posts ?? []) {
      entries.push({
        url: `${siteUrl}/blog/${post.slug}`,
        lastModified: post.updated_at
          ? new Date(post.updated_at)
          : post.published_at
            ? new Date(post.published_at)
            : now,
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }
  } catch (error) {
    console.warn(
      '[sitemap] dynamic entries skipped:',
      error instanceof Error ? error.message : error
    );
  }

  return entries;
}
