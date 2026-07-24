import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';
import { UNICODE_ROUTE_ALIASES } from '@/lib/clone/archive';

const ROUTE = UNICODE_ROUTE_ALIASES['/kopia-panienski-plus-opis'];

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(ROUTE, 'Ceramika Nero'),
  };
}

export default async function ArchiveRoutePage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
