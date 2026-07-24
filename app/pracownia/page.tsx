import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
  PartnerBadge,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { pracowniaPage } from '@/lib/clone/content/pracownia';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage('pracownia', {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? pracowniaPage.title,
    resolved?.document.metaDescription ?? pracowniaPage.metaDescription
  );
}

export default async function PracowniaPage() {
  const resolved = await resolveClonePage('pracownia', {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;

  const hero = parts?.hero ?? {
    title: pracowniaPage.hero.title,
    imageSrc: pracowniaPage.hero.imageSrc,
    imageAlt: pracowniaPage.hero.imageAlt,
    logoSrc: pracowniaPage.hero.logoSrc,
    intro: pracowniaPage.hero.intro ? [...pracowniaPage.hero.intro] : undefined,
  };
  const blocks = parts?.blocks ?? [...pracowniaPage.blocks];

  return (
    <>
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingPageView
        hero={hero}
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
        blocks={blocks}
      />
    </>
  );
}
