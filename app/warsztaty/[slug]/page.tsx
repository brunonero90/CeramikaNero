export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorkshopDetail } from '@/components/workshop/workshop-detail';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { services } from '@/lib/database/factory';
import { isAdminPreviewAllowed } from '@/lib/admin/preview';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const workshop = await services.workshops.getBySlug(slug, true);

  if (!workshop) {
    return {
      title: 'Warsztat nie został znaleziony',
    };
  }

  return {
    title: workshop.seoTitle ?? workshop.title,
    description: workshop.seoDescription ?? workshop.shortDescription,
    robots: workshop.status === 'published' ? undefined : 'noindex, nofollow',
  };
}

export default async function WorkshopDetailPage({ params }: Props) {
  const { slug } = await params;
  const workshop = await services.workshops.getBySlug(slug, true);

  if (!workshop) {
    notFound();
  }

  const isPreview =
    workshop.status !== 'published' || workshop.archivedAt !== null;
  if (isPreview && !(await isAdminPreviewAllowed())) {
    notFound();
  }

  return (
    <div className="px-4 py-16 md:py-24">
      {workshop.suggestedTheme && (
        <ThemeSuggestion theme={workshop.suggestedTheme} />
      )}
      {isPreview && <PreviewBanner entityType="warsztatu" />}
      <WorkshopDetail workshop={workshop} />
    </div>
  );
}
