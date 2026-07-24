import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { dlaFirmPage } from '@/lib/clone/content/audience-pages';

export const metadata: Metadata = buildMarketingMetadata(
  dlaFirmPage.title,
  dlaFirmPage.metaDescription
);

export default function GrupyIFirmyPage() {
  return (
    <MarketingPageView
      hero={dlaFirmPage.hero}
      beforeBlocks={
        <section className="mx-auto max-w-3xl px-4 pb-6 md:px-6">
          <ul className="space-y-2 text-base text-text-primary">
            {dlaFirmPage.introBullets.map((item) => (
              <li key={item.slice(0, 40)} className="flex gap-2">
                <span className="text-accent-primary" aria-hidden>
                  ■
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-10 font-heading text-2xl font-semibold text-text-primary">
            {dlaFirmPage.whoHeading}
          </h2>
          <ul className="mt-4 space-y-2 text-base text-text-primary">
            {dlaFirmPage.whoBullets.map((item) => (
              <li key={item.slice(0, 40)} className="flex gap-2">
                <span className="text-accent-primary" aria-hidden>
                  ■
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm font-semibold tracking-wide text-text-primary uppercase">
            Dostępne pakiety:
          </p>
        </section>
      }
      blocks={dlaFirmPage.blocks}
    />
  );
}
