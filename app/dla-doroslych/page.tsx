import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { dlaDoroslychPage } from '@/lib/clone/content/audience-pages';

export const metadata: Metadata = buildMarketingMetadata(
  dlaDoroslychPage.title,
  dlaDoroslychPage.metaDescription
);

export default function DlaDoroslychPage() {
  return (
    <MarketingPageView
      hero={dlaDoroslychPage.hero}
      blocks={dlaDoroslychPage.blocks}
    />
  );
}
