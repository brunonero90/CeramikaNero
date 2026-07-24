import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/vouchery' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Vouchery | Ceramika Nero'),
  };
}

export default async function VoucheryPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
