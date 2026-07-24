import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/kontakt' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Kontakt | Ceramika Nero'),
  };
}

export default async function KontaktPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
