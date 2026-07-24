import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/cart' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Koszyk | Ceramika Nero'),
  };
}

export default async function CartPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
