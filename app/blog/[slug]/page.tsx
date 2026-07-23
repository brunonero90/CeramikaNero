import { notFound } from 'next/navigation';
import { services } from '@/lib/database/factory';
import { isAdminPreviewAllowed } from '@/lib/admin/preview';
import { renderMarkdown } from '@/lib/utils/markdown';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { ThemeSuggestion } from '@/components/theme-suggestion';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await services.blogPosts.getBySlug(slug, true);
  if (!post) return { title: 'Nie znaleziono | Ceramika Nero' };
  return {
    title: `${post.seoTitle ?? post.title} | Ceramika Nero`,
    description: post.seoDescription ?? post.excerpt,
    robots: post.status === 'published' ? undefined : 'noindex, nofollow',
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await services.blogPosts.getBySlug(slug, true);
  if (!post) notFound();

  const isPreview = post.status !== 'published' || post.archivedAt !== null;
  if (isPreview && !(await isAdminPreviewAllowed())) {
    notFound();
  }

  return (
    <article className="container mx-auto px-4 py-8">
      <ThemeSuggestion theme="atelier" />
      {isPreview && <PreviewBanner entityType="wpisu na blogu" />}
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">{post.title}</h1>
        {post.publishedAt && (
          <p className="mt-2 text-sm text-gray-600">
            {new Date(post.publishedAt).toLocaleDateString('pl-PL')}
          </p>
        )}
        {post.authorName && (
          <p className="text-sm text-gray-600">Autor: {post.authorName}</p>
        )}
      </header>
      <p className="mb-6 text-lg text-gray-700">{post.excerpt}</p>
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
      />
    </article>
  );
}
