import Image from 'next/image';
import type { Metadata } from 'next';
import { MarketingHero } from '@/components/clone/marketing';
import { buildMarketingMetadata } from '@/components/clone/marketing-page';
import { galeriaImages } from '@/lib/clone/content/landings';

export const metadata: Metadata = buildMarketingMetadata(
  'Galeria | Ceramika Nero',
  'Galeria prac i warsztatów Pracowni Ceramiki Nero — oryginalny zestaw zdjęć ze strony Galeria.'
);

export default function GaleriaPage() {
  return (
    <div className="bg-surface-bg">
      <MarketingHero
        title="Galeria"
        imageSrc="/images/wix-migrated/747d6f_b6b2ebdcb95f424984ee80e8e58a604d.jpg"
        imageAlt="iStock-1302287658 kopia.jpg"
        logoSrc="/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png"
        logoAlt="warsztaty ceramiczne, sklep z ceramika"
        intro={[
          'Wybrane prace i chwile z warsztatów Pracowni Ceramiki Nero — w oryginalnej kolejności galerii.',
        ]}
      />
      <section
        aria-label="Galeria zdjęć"
        className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 pb-16 sm:grid-cols-3 md:gap-4 md:px-6"
      >
        {galeriaImages.map((img) => (
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
