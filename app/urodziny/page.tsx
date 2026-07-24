import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { urodzinyPage } from '@/lib/clone/content/landings';

export const metadata: Metadata = buildMarketingMetadata(
  urodzinyPage.title,
  urodzinyPage.metaDescription
);

export default function UrodzinyPage() {
  return (
    <MarketingPageView hero={urodzinyPage.hero} blocks={urodzinyPage.blocks} />
  );
}
