import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { panienskiePage } from '@/lib/clone/content/glina-box-and-events';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/panienskie'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? panienskiePage.title,
    resolved?.document.metaDescription ?? panienskiePage.metaDescription
  );
}

export default async function PanienskiePage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/panienskie'), {
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
            ...panienskiePage.hero,
            intro: [...panienskiePage.hero.intro],
          }
        }
        blocks={parts?.blocks ?? [...panienskiePage.blocks]}
      />
    </>
  );
}
