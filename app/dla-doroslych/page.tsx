import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { dlaDoroslychPage } from '@/lib/clone/content/audience-pages';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/dla-doroslych'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? dlaDoroslychPage.title,
    resolved?.document.metaDescription ?? dlaDoroslychPage.metaDescription
  );
}

export default async function DlaDoroslychPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/dla-doroslych'), {
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
            ...dlaDoroslychPage.hero,
            intro: [...dlaDoroslychPage.hero.intro],
          }
        }
        blocks={parts?.blocks ?? [...dlaDoroslychPage.blocks]}
      />
    </>
  );
}
