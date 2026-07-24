import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CloneCta, MarketingHero } from '@/components/clone/marketing';
import { buildMarketingMetadata } from '@/components/clone/marketing-page';
import { glinaBoxPage } from '@/lib/clone/content/glina-box-and-events';

export const metadata: Metadata = buildMarketingMetadata(
  glinaBoxPage.title,
  glinaBoxPage.metaDescription
);

function FeatureSplit({
  title,
  paragraphs,
  bullets = [],
  imageSrc,
  imageAlt,
  ctaLabel,
  ctaHref,
  imageFirst,
}: {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  imageSrc: string;
  imageAlt: string;
  ctaLabel: string;
  ctaHref: string;
  imageFirst: boolean;
}) {
  return (
    <section className="border-t border-surface-subtle/40 bg-surface-bg">
      <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-6">
        <div className={imageFirst ? undefined : 'md:order-2'}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={488}
            height={609}
            className="h-auto w-full object-cover"
            sizes="(max-width: 768px) 100vw, 488px"
          />
        </div>
        <div
          className={`bg-surface-raised p-6 shadow-sm md:p-8 ${imageFirst ? '' : 'md:order-1'}`}
        >
          <h2 className="font-heading text-2xl font-semibold text-text-primary md:text-3xl">
            {title}
          </h2>
          {paragraphs.map((p) => (
            <p
              key={p.slice(0, 40)}
              className="mt-4 text-base leading-relaxed text-text-muted"
            >
              {p}
            </p>
          ))}
          {bullets.length > 0 ? (
            <ul className="mt-5 space-y-2 text-base text-text-primary">
              {bullets.map((item) => (
                <li key={item.slice(0, 48)} className="flex gap-2">
                  <span className="text-accent-primary" aria-hidden>
                    ■
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8">
            <CloneCta href={ctaHref}>{ctaLabel}</CloneCta>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function GlinaBoxHomePage() {
  return (
    <div className="bg-surface-bg">
      <MarketingHero
        title={glinaBoxPage.hero.title}
        imageSrc={glinaBoxPage.hero.imageSrc}
        imageAlt={glinaBoxPage.hero.imageAlt}
        logoSrc={glinaBoxPage.hero.logoSrc}
        intro={[...glinaBoxPage.hero.intro]}
      />

      <section className="mx-auto max-w-3xl px-4 pb-10 text-center md:px-6">
        {glinaBoxPage.introBlocks.map((p) => (
          <p
            key={p.slice(0, 48)}
            className="mt-4 text-base leading-relaxed text-text-muted first:mt-0 md:text-lg"
          >
            {p}
          </p>
        ))}
        <div className="mx-auto mt-8 max-w-xl">
          <Image
            src={glinaBoxPage.giftBannerSrc}
            alt={glinaBoxPage.giftBannerAlt}
            width={476}
            height={317}
            className="mx-auto h-auto w-full object-contain"
          />
          <p className="sr-only">WYJĄTKOWY PREZENT</p>
        </div>
        <div className="mt-8">
          <CloneCta href={glinaBoxPage.primaryCta.href}>
            {glinaBoxPage.primaryCta.label}
          </CloneCta>
        </div>
        <div className="mt-8">
          <Image
            src={glinaBoxPage.bannerSrc}
            alt=""
            width={737}
            height={73}
            className="mx-auto h-auto w-full max-w-3xl object-contain"
          />
        </div>
      </section>

      <FeatureSplit {...glinaBoxPage.breath} imageFirst />
      <FeatureSplit {...glinaBoxPage.course} imageFirst={false} />

      <section
        aria-label="Produkty GLINA BOX"
        className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-14 md:px-6"
      >
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {glinaBoxPage.products.map((product) => (
            <article
              key={product.id}
              className="flex flex-col border border-surface-subtle/40 bg-surface-raised"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={product.imageSrc}
                  alt={product.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs font-semibold tracking-wide text-accent-primary uppercase">
                  Podgląd · {product.badge}
                </p>
                <h2 className="mt-2 font-heading text-xl font-semibold text-text-primary">
                  {product.title}
                </h2>
                <p className="mt-4 text-sm text-text-muted">
                  {product.priceLabel}
                </p>
                <p className="text-lg font-semibold text-text-primary">
                  {product.price}
                </p>
                {'salePrice' in product && product.salePrice ? (
                  <>
                    <p className="mt-2 text-sm text-text-muted">
                      {product.saleLabel}
                    </p>
                    <p className="text-lg font-semibold text-accent-primary">
                      {product.salePrice}
                    </p>
                  </>
                ) : null}
                <div className="mt-auto pt-6">
                  <CloneCta href={product.href} className="w-full">
                    {product.ctaLabel}
                  </CloneCta>
                  <p className="mt-2 text-center text-xs text-text-muted">
                    Koszyk lokalny — bez płatności online w tej fazie.
                  </p>
                  <Link
                    href={product.href}
                    className="mt-2 block text-center text-sm text-accent-primary underline-offset-2 hover:underline"
                  >
                    Podgląd
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <FeatureSplit {...glinaBoxPage.shipping} imageFirst />
    </div>
  );
}
