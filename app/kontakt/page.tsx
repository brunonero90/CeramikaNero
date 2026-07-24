import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import { bookingAdaptationFor, getArchivePage } from '@/lib/clone/archive';

const ROUTE = '/kontakt' as const;

export const metadata: Metadata = {
  title: getArchivePage(ROUTE)?.title ?? 'Ceramika Nero',
};

export default function ArchiveRoutePage() {
  const page = getArchivePage(ROUTE);
  if (!page) notFound();
  return (
    <ArchivePageView
      page={page}
      bookingAdaptation={bookingAdaptationFor(ROUTE) ?? undefined}
    />
  );
}
