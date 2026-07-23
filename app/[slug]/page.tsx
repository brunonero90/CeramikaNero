import { notFound } from 'next/navigation';
import { services } from '@/lib/database/factory';
import { isAdminPreviewAllowed } from '@/lib/admin/preview';
import { renderMarkdown } from '@/lib/utils/markdown';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { isReservedPageSlug } from '@/lib/utils/reserved-slugs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isReservedPageSlug(slug)) {
    return { title: 'Nie znaleziono | Ceramika Nero' };
  }
  const page = await services.contentPages.getBySlug(slug, true);
  if (!page) return { title: 'Nie znaleziono | Ceramika Nero' };
  return {
    title: `${page.seoTitle ?? page.title} | Ceramika Nero`,
    description: page.seoDescription ?? page.excerpt ?? '',
    robots: page.status === 'published' ? undefined : 'noindex, nofollow',
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isReservedPageSlug(slug)) {
    notFound();
  }

  const page = await services.contentPages.getBySlug(slug, true);
  if (!page) notFound();

  const isPreview = page.status !== 'published' || page.archivedAt !== null;
  if (isPreview && !(await isAdminPreviewAllowed())) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {page.suggestedTheme && <ThemeSuggestion theme={page.suggestedTheme} />}
      {isPreview && <PreviewBanner entityType="strony" />}
      <h1 className="mb-6 text-3xl font-semibold">{page.title}</h1>
      {page.excerpt && (
        <p className="mb-6 text-lg text-gray-700">{page.excerpt}</p>
      )}
      {page.content && (
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
        />
      )}
    </div>
  );
}
