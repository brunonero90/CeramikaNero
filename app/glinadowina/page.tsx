import type { Metadata } from 'next';
import {
  buildMarketingMetadata,
  MarketingPageView,
} from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToMarketingParts } from '@/lib/cms/document-adapters';
import { glinaDoWinaPage } from '@/lib/clone/content/landings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage('glinadowina', {
    allowDraftPreview: true,
  });
  const title = resolved?.document.title ?? glinaDoWinaPage.title;
  const description =
    resolved?.document.metaDescription ?? glinaDoWinaPage.metaDescription;
  return buildMarketingMetadata(title, description);
}

export default async function GlinaDoWinaPage() {
  const resolved = await resolveClonePage('glinadowina', {
    allowDraftPreview: true,
  });
  const parts =
    (resolved && documentToMarketingParts(resolved.document)) || null;

  const hero = parts?.hero ?? {
    title: glinaDoWinaPage.hero.title,
    imageSrc: glinaDoWinaPage.hero.imageSrc,
    imageAlt: glinaDoWinaPage.hero.imageAlt,
    logoSrc: glinaDoWinaPage.hero.logoSrc,
    intro: [...glinaDoWinaPage.hero.intro],
  };
  const blocks = parts?.blocks ?? [...glinaDoWinaPage.blocks];

  return (
    <>
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingPageView hero={hero} blocks={blocks} />
    </>
  );
}
