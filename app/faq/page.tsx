import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/faq' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: await resolvedArchiveTitle(ROUTE, 'FAQ | Ceramika Nero') };
}

export default async function FaqPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
