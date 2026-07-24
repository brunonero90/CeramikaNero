import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { dlaDzieciPage } from '@/lib/clone/content/audience-pages';

export const metadata: Metadata = buildMarketingMetadata(
  dlaDzieciPage.title,
  dlaDzieciPage.metaDescription
);

export default function DlaDzieciPage() {
  return (
    <MarketingPageView
      hero={dlaDzieciPage.hero}
      blocks={dlaDzieciPage.blocks}
    />
  );
}
