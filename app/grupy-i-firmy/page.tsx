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

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage('grupy-i-firmy', {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? dlaFirmPage.title,
    resolved?.document.metaDescription ?? dlaFirmPage.metaDescription
  );
}

export default async function GrupyIFirmyPage() {
  const resolved = await resolveClonePage('grupy-i-firmy', {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;

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
        blocks={parts?.blocks ?? [...dlaFirmPage.blocks]}
      />
    </>
  );
}
