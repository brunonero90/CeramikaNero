import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/gift-card' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Gift card | Ceramika Nero'),
  };
}

export default async function GiftCardPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
