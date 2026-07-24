import Image from 'next/image';
import type { Metadata } from 'next';
import { CloneCta, MarketingHero } from '@/components/clone/marketing';
import { buildMarketingMetadata } from '@/components/clone/marketing-page';
import { glinaBoxPage } from '@/lib/clone/content/landings';

export const metadata: Metadata = buildMarketingMetadata(
  glinaBoxPage.title,
  glinaBoxPage.metaDescription
);

export default function GlinaBoxHomePage() {
  return (
    <div className="bg-surface-bg">
      <MarketingHero {...glinaBoxPage.hero} />
      <div className="mx-auto max-w-5xl px-4 pb-6 md:px-6">
        <Image
          src={glinaBoxPage.bannerSrc}
          alt=""
          width={737}
          height={73}
          className="mx-auto h-auto w-full max-w-3xl object-contain"
        />
      </div>
      <section
        aria-label="Galeria GLINA BOX"
        className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-2 md:px-6"
      >
        {glinaBoxPage.gallery.map((item) => (
          <div
            key={item.src + item.alt}
            className="relative aspect-[4/5] overflow-hidden"
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          </div>
        ))}
      </section>
      <div className="pb-16 text-center">
        <CloneCta href="/kontakt">Zapytaj o GLINA BOX</CloneCta>
      </div>
    </div>
  );
}
