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
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/pracownia'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? pracowniaPage.title,
    resolved?.document.metaDescription ?? pracowniaPage.metaDescription
  );
}

export default async function PracowniaPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/pracownia'), {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;

  const mid = parts?.midCopy ?? pracowniaPage.midCopy;
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
              {mid.workshopsHeading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              {mid.workshopsBody}
            </p>
            <h2 className="mt-10 font-heading text-2xl font-semibold text-text-primary">
              {mid.contactHeading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              {mid.contactBody}
            </p>
            <PartnerBadge src={mid.badgeSrc} alt={mid.badgeAlt} />
            <p className="mt-6 text-sm font-semibold tracking-wide text-text-primary uppercase">
              {'packagesLabel' in mid && mid.packagesLabel
                ? mid.packagesLabel
                : 'Dostępne warsztaty:'}
            </p>
          </section>
        }
        blocks={blocks}
      />
    </>
  );
}
