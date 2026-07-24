import Image from 'next/image';
import type { Metadata } from 'next';
import { MarketingHero } from '@/components/clone/marketing';
import { buildMarketingMetadata } from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { galeriaImages } from '@/lib/clone/content/landings';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToGallery } from '@/lib/cms/document-adapters';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

const FALLBACK_META = {
  title: 'Galeria | Ceramika Nero',
  description:
    'Galeria prac i warsztatów Pracowni Ceramiki Nero — oryginalny zestaw zdjęć ze strony Galeria.',
};

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/galeria'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? FALLBACK_META.title,
    resolved?.document.metaDescription ?? FALLBACK_META.description
  );
}

export default async function GaleriaPage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/galeria'), {
    allowDraftPreview: true,
  });
  const parts = resolved ? documentToGallery(resolved.document) : null;
  const hero = parts?.hero ?? {
    title: 'Rękodzieło jako joga umysłu',
    imageSrc:
      '/images/wix-migrated/747d6f_b6b2ebdcb95f424984ee80e8e58a604d.jpg',
    imageAlt: 'iStock-1302287658 kopia.jpg',
    logoSrc: '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png',
    logoAlt: 'warsztaty ceramiczne, sklep z ceramika',
    intro: ['Galeria', 'Moja pasja ... w obiektywie aparatu.'],
  };
  const images = parts?.images ?? [...galeriaImages];

  return (
    <div className="bg-surface-bg">
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingHero {...hero} />
      <section
        aria-label="Galeria zdjęć"
        className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 pb-16 sm:grid-cols-3 md:gap-4 md:px-6"
      >
        {images.map((img) => (
          <figure
            key={img.src + img.alt}
            className="relative aspect-[312/393] overflow-hidden bg-surface-subtle/30"
          >
            <Image
              src={img.src}
              alt={img.alt}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
          </figure>
        ))}
      </section>
    </div>
  );
}
