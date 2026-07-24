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

export default async function UrodzinyPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/urodziny'), {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;
  const offer = parts?.offerIntro ?? urodzinyPage.offerIntro;

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
          <section className="mx-auto max-w-3xl px-4 pb-8 md:px-6">
            <h2 className="font-heading text-2xl font-semibold text-text-primary">
              {offer.heading}
            </h2>
            {offer.paragraphs.map((p) => (
              <p
                key={p.slice(0, 48)}
                className="mt-4 text-base leading-relaxed text-text-muted"
              >
                {p}
              </p>
            ))}
          </section>
        }
        blocks={parts?.blocks ?? [...urodzinyPage.blocks]}
      />
    </>
  );
}
