import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { panienskiePage } from '@/lib/clone/content/glina-box-and-events';

export const metadata: Metadata = buildMarketingMetadata(
  panienskiePage.title,
  panienskiePage.metaDescription
);

export default function PanienskiePage() {
  return (
    <MarketingPageView
      hero={panienskiePage.hero}
      blocks={panienskiePage.blocks}
    />
  );
}
