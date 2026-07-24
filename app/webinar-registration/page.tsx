import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/webinar-registration';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Ceramika Nero'),
  };
}

export default async function ArchiveRoutePage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
