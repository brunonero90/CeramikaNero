import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/dostawy-i-zwroty' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(
      ROUTE,
      'Dostawy i zwroty | Ceramika Nero'
    ),
  };
}

export default async function DostawyIZwrotyPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
