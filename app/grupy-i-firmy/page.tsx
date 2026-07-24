import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { dlaFirmPage } from '@/lib/clone/content/audience-pages';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/grupy-i-firmy'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? dlaFirmPage.title,
    resolved?.document.metaDescription ?? dlaFirmPage.metaDescription
  );
}

export default async function GrupyIFirmyPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/grupy-i-firmy'), {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;

  const introList =
    parts?.bulletLists.find((l) => l.id === 'intro-bullets') ??
    ({
      id: 'intro-bullets',
      heading: null,
      bullets: [...dlaFirmPage.introBullets],
    } as const);
  const whoList =
    parts?.bulletLists.find((l) => l.id === 'who-bullets') ??
    ({
      id: 'who-bullets',
      heading: dlaFirmPage.whoHeading,
      bullets: [...dlaFirmPage.whoBullets],
      footerNote: 'Dostępne pakiety:',
    } as const);

  return (
    <>
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingPageView
        hero={
          parts?.hero ?? {
            ...dlaFirmPage.hero,
            intro: dlaFirmPage.hero.intro
              ? [...dlaFirmPage.hero.intro]
              : undefined,
          }
        }
        beforeBlocks={
          <section className="mx-auto max-w-3xl px-4 pb-6 md:px-6">
            <ul className="space-y-2 text-base text-text-primary">
              {introList.bullets.map((item) => (
                <li key={item.slice(0, 40)} className="flex gap-2">
                  <span className="text-accent-primary" aria-hidden>
                    ■
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {whoList.heading ? (
              <h2 className="mt-10 font-heading text-2xl font-semibold text-text-primary">
                {whoList.heading}
              </h2>
            ) : null}
            <ul className="mt-4 space-y-2 text-base text-text-primary">
              {whoList.bullets.map((item) => (
                <li key={item.slice(0, 40)} className="flex gap-2">
                  <span className="text-accent-primary" aria-hidden>
                    ■
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {whoList.footerNote ? (
              <p className="mt-8 text-sm font-semibold tracking-wide text-text-primary uppercase">
                {whoList.footerNote}
              </p>
            ) : null}
          </section>
        }
        blocks={parts?.blocks ?? [...dlaFirmPage.blocks]}
      />
    </>
  );
}
