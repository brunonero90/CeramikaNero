import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/services' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Usługi | Ceramika Nero'),
  };
}

export default async function ServicesPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
