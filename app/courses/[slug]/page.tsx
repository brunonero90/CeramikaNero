import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import {
  bookingAdaptationFor,
  getArchivePage,
  listArchiveRoutes,
} from '@/lib/clone/archive';

const PREFIX = '/courses/' as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listArchiveRoutes()
    .filter((r) => r.startsWith(PREFIX))
    .map((r) => ({ slug: decodeURIComponent(r.slice(PREFIX.length)) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getArchivePage(PREFIX + slug);
  return { title: page?.title ?? 'Ceramika Nero' };
}

export default async function DynamicArchivePage({ params }: Props) {
  const { slug } = await params;
  const route = PREFIX + slug;
  const page = getArchivePage(route);
  if (!page) notFound();
  return (
    <ArchivePageView
      page={page}
      bookingAdaptation={bookingAdaptationFor(route) ?? undefined}
    />
  );
}
