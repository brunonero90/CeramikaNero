import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { urodzinyPage } from '@/lib/clone/content/glina-box-and-events';

export const metadata: Metadata = buildMarketingMetadata(
  urodzinyPage.title,
  urodzinyPage.metaDescription
);

export default function UrodzinyPage() {
  return (
    <MarketingPageView
      hero={urodzinyPage.hero}
      beforeBlocks={
        <section className="mx-auto max-w-3xl px-4 pb-8 md:px-6">
          <h2 className="font-heading text-2xl font-semibold text-text-primary">
            {urodzinyPage.offerIntro.heading}
          </h2>
          {urodzinyPage.offerIntro.paragraphs.map((p) => (
            <p
              key={p.slice(0, 48)}
              className="mt-4 text-base leading-relaxed text-text-muted"
            >
              {p}
            </p>
          ))}
        </section>
      }
      blocks={urodzinyPage.blocks}
    />
  );
}
