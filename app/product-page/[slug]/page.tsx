import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import { AddToLocalCartButton } from '@/components/clone/add-to-cart-button';
import { getArchivePage, listArchiveRoutes } from '@/lib/clone/archive';

const PREFIX = '/product-page/' as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listArchiveRoutes()
    .filter((r) => r.startsWith(PREFIX))
    .map((r) => ({ slug: decodeURIComponent(r.slice(PREFIX.length)) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getArchivePage(PREFIX + slug);
  return { title: page?.title ?? 'Produkt' };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const route = PREFIX + slug;
  const page = getArchivePage(route);
  if (!page) notFound();

  const priceMatch = page.sections
    .map((s) => s.text)
    .join('\n')
    .match(/(\d+,\d{2}\s*zł)/);
  const priceLabel = priceMatch?.[1] ?? '';

  return (
    <div className="bg-surface-bg">
      <ArchivePageView page={page} />
      <div className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <AddToLocalCartButton
          id={slug}
          title={page.title}
          priceLabel={priceLabel}
          href={route}
        />
      </div>
    </div>
  );
}
