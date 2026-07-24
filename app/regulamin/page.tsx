import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/regulamin' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Regulamin | Ceramika Nero'),
  };
}

export default async function RegulaminPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
