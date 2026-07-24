import type { Metadata } from 'next';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';

const ROUTE = '/terms-conditions' as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: await resolvedArchiveTitle(
      ROUTE,
      'Terms & Conditions | Ceramika Nero'
    ),
  };
}

export default async function TermsConditionsPage() {
  return <ResolvedArchivePage route={ROUTE} />;
}
