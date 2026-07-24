import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import {
  bookingAdaptationFor,
  getArchivePage,
  listArchiveRoutes,
} from '@/lib/clone/archive';

const PREFIX = '/booking-calendar/' as const;

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listArchiveRoutes()
    .filter((r) => r.startsWith(PREFIX))
    .map((r) => {
      const raw = r.slice(PREFIX.length);
      try {
        return { slug: decodeURIComponent(raw) };
      } catch {
        return { slug: raw };
      }
    });
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
