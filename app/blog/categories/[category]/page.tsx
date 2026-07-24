import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogIndexView, getOrderedBlogPosts } from '@/components/clone/blog';
import { archiveBlogCategories } from '@/lib/clone/content/phase2/blog-categories';

const CATEGORY_MAP: Record<string, { label: string; match: RegExp }> = {
  aktualności: {
    label: 'Aktualności',
    match: /aktualn/i,
  },
  ciekawostki: {
    label: 'Ciekawostki',
    match: /ciekawost/i,
  },
  'o-mnie': {
    label: 'O mnie',
    match: /o mnie|małgosia|pasjonatk/i,
  },
};

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const key = decodeURIComponent(category);
  const meta = CATEGORY_MAP[key];
  return {
    title: meta ? `Blog — ${meta.label}` : 'Blog',
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  const key = decodeURIComponent(category);
  const meta = CATEGORY_MAP[key];
  if (!meta) notFound();

  const archiveCat = (
    archiveBlogCategories as unknown as Record<
      string,
      {
        sections?: {
          buttons?: { href: string; label: string }[];
        }[];
      }
    >
  )[key];

  const hrefs = new Set<string>();
  for (const section of archiveCat?.sections || []) {
    for (const b of section.buttons || []) {
      if (b.href?.startsWith('/post/')) hrefs.add(decodeURIComponent(b.href));
    }
  }

  let posts = getOrderedBlogPosts().filter((p) => hrefs.has(p.route));
  if (posts.length === 0) {
    // Fallback: filter by title/body category hints when button extraction is thin
    posts = getOrderedBlogPosts().filter(
      (p) =>
        meta.match.test(p.title) ||
        p.paragraphs.some((para) => meta.match.test(para))
    );
  }
  // O mnie typically single author post
  if (key === 'o-mnie' && posts.length === 0) {
    posts = getOrderedBlogPosts().filter((p) => p.slug === 'o-mnie');
  }

  return <BlogIndexView posts={posts} categoryLabel={meta.label} />;
}
