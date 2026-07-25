import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { urodzinyPage } from '@/lib/clone/content/glina-box-and-events';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/urodziny'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? urodzinyPage.title,
    resolved?.document.metaDescription ?? urodzinyPage.metaDescription
  );
}

/**
 * Page-specific /urodziny template — archive crops + compact package rhythm.
 * Does not use the shared max-w-prose archive shell.
 */
export default async function UrodzinyPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/urodziny'), {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;
  const offer = parts?.offerIntro ?? urodzinyPage.offerIntro;
  const fixtureBlocks = [...urodzinyPage.blocks];
  const blocks = (parts?.blocks ?? fixtureBlocks).map((b) => {
    const fixture = fixtureBlocks.find((f) => f.id === b.id);
    return {
      ...b,
      compact: true,
      imageWidth: b.imageWidth ?? fixture?.imageWidth,
      imageHeight: b.imageHeight ?? fixture?.imageHeight,
      imageSrc: fixture?.imageSrc ?? b.imageSrc,
      imageAlt: fixture?.imageAlt ?? b.imageAlt,
      imageFirst: fixture?.imageFirst ?? b.imageFirst,
      tinted: fixture?.tinted ?? b.tinted,
    };
  });

  return (
    <>
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingPageView
        hero={
          parts?.hero ?? {
            ...urodzinyPage.hero,
            intro: [...urodzinyPage.hero.intro],
          }
        }
        beforeBlocks={
          <section className="mx-auto max-w-[720px] px-4 pb-5 text-center md:px-6">
            <h2 className="font-heading text-[1.65rem] font-semibold text-[#a85a48] md:text-[1.9rem]">
              {offer.heading}
            </h2>
            {offer.paragraphs.map((p, idx) => {
              const m = p.match(/^([^:]{3,40}):\s*(.*)$/);
              return (
                <p
                  key={p.slice(0, 48)}
                  className={
                    idx === 0
                      ? 'mt-3 text-[14px] leading-[1.65] text-[#5c4038] italic md:text-[15px]'
                      : 'mt-3 text-[14px] leading-[1.65] text-[#5c4038] md:text-[15px]'
                  }
                >
                  {m ? (
                    <>
                      <strong className="font-semibold text-[#3d2a24] not-italic">
                        {m[1]}:
                      </strong>{' '}
                      {m[2]}
                    </>
                  ) : (
                    p
                  )}
                </p>
              );
            })}
          </section>
        }
        blocks={blocks}
      />
    </>
  );
}
