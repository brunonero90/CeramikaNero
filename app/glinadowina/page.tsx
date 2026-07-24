import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { glinaDoWinaPage } from '@/lib/clone/content/landings';

export const metadata: Metadata = buildMarketingMetadata(
  glinaDoWinaPage.title,
  glinaDoWinaPage.metaDescription
);

export default function GlinaDoWinaPage() {
  return (
    <MarketingPageView
      hero={glinaDoWinaPage.hero}
      blocks={glinaDoWinaPage.blocks}
    />
  );
}
