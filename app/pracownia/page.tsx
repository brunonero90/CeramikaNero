export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';

export async function generateMetadata(): Promise<Metadata> {
  const page = await services.contentPages.getBySlug('pracownia');
  return {
    title: page?.seoTitle ?? 'Pracownia',
    description: page?.seoDescription,
  };
}

export default async function PracowniaPage() {
  const page = await services.contentPages.getBySlug('pracownia');

  if (!page) {
    notFound();
  }

  return (
    <div className="px-4 py-16 md:py-24">
      {page.suggestedTheme && <ThemeSuggestion theme={page.suggestedTheme} />}
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
          {page.title}
        </h1>
        {page.content && (
          <p className="mt-6 whitespace-pre-line text-lg text-text-primary">
            {page.content}
          </p>
        )}
      </div>
    </div>
  );
}
