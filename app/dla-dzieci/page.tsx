import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { dlaDzieciPage } from '@/lib/clone/content/audience-pages';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage('dla-dzieci', {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? dlaDzieciPage.title,
    resolved?.document.metaDescription ?? dlaDzieciPage.metaDescription
  );
}

export default async function DlaDzieciPage() {
  const resolved = await resolveClonePage('dla-dzieci', {
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
            ...dlaDzieciPage.hero,
            intro: [...dlaDzieciPage.hero.intro],
          }
        }
        blocks={parts?.blocks ?? [...dlaDzieciPage.blocks]}
      />
    </>
  );
}
