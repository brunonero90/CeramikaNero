import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
  PartnerBadge,
} from '@/components/clone/marketing-page';
import { pracowniaPage } from '@/lib/clone/content/pracownia';

export const metadata: Metadata = buildMarketingMetadata(
  pracowniaPage.title,
  pracowniaPage.metaDescription
);

export default function PracowniaPage() {
  return (
    <MarketingPageView
      hero={pracowniaPage.hero}
      afterHero={
        <section className="mx-auto max-w-3xl px-4 pb-10 text-center md:px-6">
          <h2 className="font-heading text-2xl font-semibold text-text-primary">
            {pracowniaPage.midCopy.workshopsHeading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            {pracowniaPage.midCopy.workshopsBody}
          </p>
          <h2 className="mt-10 font-heading text-2xl font-semibold text-text-primary">
            {pracowniaPage.midCopy.contactHeading}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            {pracowniaPage.midCopy.contactBody}
          </p>
          <PartnerBadge
            src={pracowniaPage.midCopy.badgeSrc}
            alt={pracowniaPage.midCopy.badgeAlt}
          />
          <p className="mt-6 text-sm font-semibold tracking-wide text-text-primary uppercase">
            Dostępne warsztaty:
          </p>
        </section>
      }
      blocks={pracowniaPage.blocks}
    />
  );
}
