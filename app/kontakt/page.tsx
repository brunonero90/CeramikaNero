export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { services } from '@/lib/database/factory';

export async function generateMetadata(): Promise<Metadata> {
  const page = await services.contentPages.getBySlug('kontakt');
  return {
    title: page?.seoTitle ?? 'Kontakt',
    description: page?.seoDescription,
  };
}

export default async function KontaktPage() {
  const page = await services.contentPages.getBySlug('kontakt');

  if (!page) {
    notFound();
  }

  return (
    <div className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
          {page.title}
        </h1>
        {page.content && (
          <p className="mt-6 whitespace-pre-line text-lg text-text-primary">
            {page.content}
          </p>
        )}
        <p className="mt-8 text-text-muted">
          Formularz kontaktowy będzie dostępny w kolejnej fazie projektu.
        </p>
      </div>
    </div>
  );
}
