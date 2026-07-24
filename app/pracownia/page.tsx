export const dynamic = 'force-dynamic';

import Image from 'next/image';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { getPracowniaImages } from '@/lib/media/wix-catalog';

export async function generateMetadata(): Promise<Metadata> {
  const page = await services.contentPages.getBySlug('pracownia');
  return {
    title: page?.seoTitle ?? 'Pracownia',
    description: page?.seoDescription,
  };
}

export default async function PracowniaPage() {
  const page = await services.contentPages.getBySlug('pracownia');
  const images = getPracowniaImages();

  if (!page) {
    notFound();
  }

  return (
    <div className="px-4 py-16 md:py-24">
      {page.suggestedTheme && <ThemeSuggestion theme={page.suggestedTheme} />}
      <div className="mx-auto max-w-5xl">
        {images[0] && (
          <div className="relative mb-10 aspect-[21/9] w-full overflow-hidden">
            <Image
              src={images[0].src}
              alt={images[0].alt || 'Pracownia Ceramika Nero'}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        )}
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
        {images.length > 1 && (
          <ul className="mt-12 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {images.slice(1).map((image) => (
              <li key={image.id}>
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={image.src}
                    alt={image.alt || 'Pracownia Ceramika Nero'}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
