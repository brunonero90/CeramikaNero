import Image from 'next/image';
import type { Metadata } from 'next';
import { CloneCta, MarketingHero } from '@/components/clone/marketing';
import { buildMarketingMetadata } from '@/components/clone/marketing-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { glinaBoxPage } from '@/lib/clone/content/glina-box-and-events';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToGlinaBox } from '@/lib/cms/document-adapters';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/home'), {
    allowDraftPreview: true,
  });
  return buildMarketingMetadata(
    resolved?.document.title ?? glinaBoxPage.title,
    resolved?.document.metaDescription ?? glinaBoxPage.metaDescription
  );
}

function FeatureSplit({
  title,
  paragraphs,
  bullets = [],
  imageSrc,
  imageAlt,
  imageWidth,
  imageHeight,
  ctaLabel,
  ctaHref,
  imageFirst,
}: {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  imageSrc: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  ctaLabel: string;
  ctaHref: string;
  imageFirst: boolean;
}) {
  return (
    <section className="bg-[#fdf8f4]">
      <div className="mx-auto grid max-w-[980px] items-start gap-5 px-4 py-6 md:grid-cols-2 md:gap-6 md:px-0 md:py-7">
        <div className={imageFirst ? undefined : 'md:order-2'}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="h-auto w-full object-cover"
            style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
            sizes="(max-width: 768px) 100vw, 488px"
          />
        </div>
        <div className={imageFirst ? undefined : 'md:order-1'}>
          <h2 className="font-heading text-[1.55rem] font-semibold text-[#a85a48] md:text-[1.85rem]">
            {title}
          </h2>
          {paragraphs.map((p) => (
            <p
              key={p.slice(0, 40)}
              className="mt-3 text-[14px] leading-[1.65] text-[#5c4038] md:text-[15px]"
            >
              {p}
            </p>
          ))}
          {bullets.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-[14px] text-[#3d2a24] md:text-[15px]">
              {bullets.map((item) => (
                <li key={item.slice(0, 48)} className="flex gap-2">
                  <span className="text-[#a85a48]" aria-hidden>
                    ■
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5">
            <CloneCta href={ctaHref}>{ctaLabel}</CloneCta>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function GlinaBoxHomePage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/home'), {
    allowDraftPreview: true,
  });
  const parts = resolved ? documentToGlinaBox(resolved.document) : null;

  const hero = parts?.hero ?? {
    title: glinaBoxPage.hero.title,
    imageSrc: glinaBoxPage.hero.imageSrc,
    imageAlt: glinaBoxPage.hero.imageAlt,
    logoSrc: glinaBoxPage.hero.logoSrc,
    intro: [...glinaBoxPage.hero.intro],
  };
  const introBlocks = parts?.introBlocks?.length
    ? parts.introBlocks
    : [...glinaBoxPage.introBlocks];
  const gift =
    parts?.labeledImages.find(
      (i) => i.type === 'labeled-image' && i.id === 'gift-banner'
    ) ?? null;
  const strip =
    parts?.labeledImages.find(
      (i) => i.type === 'labeled-image' && i.id === 'strip-banner'
    ) ?? null;
  const primaryCta =
    parts?.ctas.find((c) => c.type === 'cta-block' && c.id === 'primary-cta') ??
    null;
  const breath = parts?.splits.find(
    (s) => s.type === 'split-block' && s.id === 'breath'
  );
  const course = parts?.splits.find(
    (s) => s.type === 'split-block' && s.id === 'course'
  );
  const shipping = parts?.splits.find(
    (s) => s.type === 'split-block' && s.id === 'shipping'
  );
  const products =
    parts?.products.filter((p) => p.type === 'product-card') ??
    glinaBoxPage.products.map((product) => ({
      type: 'product-card' as const,
      ...product,
    }));

  return (
    <div className="bg-surface-bg">
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <MarketingHero
        title={hero.title}
        imageSrc={hero.imageSrc}
        imageAlt={hero.imageAlt}
        logoSrc={hero.logoSrc}
        intro={[...(hero.intro ?? [])]}
      />

      <section className="mx-auto max-w-[720px] px-4 pb-6 text-center md:px-6">
        {introBlocks.map((p) => (
          <p
            key={p.slice(0, 48)}
            className="mt-3 text-[14px] leading-[1.65] text-[#5c4038] first:mt-0 md:text-[15px]"
          >
            {p}
          </p>
        ))}
        <div className="mx-auto mt-6 w-full max-w-[476px]">
          <Image
            src={
              gift && gift.type === 'labeled-image'
                ? gift.src
                : glinaBoxPage.giftBannerSrc
            }
            alt={
              gift && gift.type === 'labeled-image'
                ? gift.alt
                : glinaBoxPage.giftBannerAlt
            }
            width={476}
            height={317}
            className="mx-auto h-[317px] w-full max-w-[476px] object-cover"
          />
          <p className="sr-only">WYJĄTKOWY PREZENT</p>
        </div>
        <div className="mt-6">
          <CloneCta
            href={
              primaryCta && primaryCta.type === 'cta-block'
                ? primaryCta.href
                : glinaBoxPage.primaryCta.href
            }
          >
            {primaryCta && primaryCta.type === 'cta-block'
              ? primaryCta.label
              : glinaBoxPage.primaryCta.label}
          </CloneCta>
        </div>
        <div className="mt-6">
          <Image
            src={
              strip && strip.type === 'labeled-image'
                ? strip.src
                : glinaBoxPage.bannerSrc
            }
            alt=""
            width={737}
            height={73}
            className="mx-auto h-[73px] w-full max-w-[737px] object-cover"
          />
        </div>
      </section>

      <FeatureSplit
        title={
          breath && breath.type === 'split-block'
            ? breath.title
            : glinaBoxPage.breath.title
        }
        paragraphs={
          breath && breath.type === 'split-block'
            ? (breath.paragraphs ?? [])
            : glinaBoxPage.breath.paragraphs
        }
        bullets={
          breath && breath.type === 'split-block'
            ? (breath.bullets ?? [])
            : glinaBoxPage.breath.bullets
        }
        imageSrc={
          breath && breath.type === 'split-block'
            ? breath.imageSrc
            : glinaBoxPage.breath.imageSrc
        }
        imageAlt={
          breath && breath.type === 'split-block'
            ? breath.imageAlt
            : glinaBoxPage.breath.imageAlt
        }
        imageWidth={488}
        imageHeight={609}
        ctaLabel={
          breath && breath.type === 'split-block'
            ? (breath.ctaLabel ?? '')
            : glinaBoxPage.breath.ctaLabel
        }
        ctaHref={
          breath && breath.type === 'split-block'
            ? (breath.ctaHref ?? '/sklep')
            : glinaBoxPage.breath.ctaHref
        }
        imageFirst
      />
      <FeatureSplit
        title={
          course && course.type === 'split-block'
            ? course.title
            : glinaBoxPage.course.title
        }
        paragraphs={
          course && course.type === 'split-block'
            ? (course.paragraphs ?? [])
            : glinaBoxPage.course.paragraphs
        }
        bullets={
          course && course.type === 'split-block'
            ? (course.bullets ?? [])
            : glinaBoxPage.course.bullets
        }
        imageSrc={
          course && course.type === 'split-block'
            ? course.imageSrc
            : glinaBoxPage.course.imageSrc
        }
        imageAlt={
          course && course.type === 'split-block'
            ? course.imageAlt
            : glinaBoxPage.course.imageAlt
        }
        imageWidth={488}
        imageHeight={512}
        ctaLabel={
          course && course.type === 'split-block'
            ? (course.ctaLabel ?? '')
            : glinaBoxPage.course.ctaLabel
        }
        ctaHref={
          course && course.type === 'split-block'
            ? (course.ctaHref ?? '/sklep')
            : glinaBoxPage.course.ctaHref
        }
        imageFirst={false}
      />

      <section
        aria-label="Produkty GLINA BOX"
        className="bg-[#f8ebe3] px-4 py-6 md:px-6 md:py-7"
      >
        <div className="mx-auto grid max-w-[980px] gap-5 md:grid-cols-2 md:gap-6">
          {products.map((product) => {
            if (product.type !== 'product-card') return null;
            return (
              <article key={product.id} className="flex flex-col">
                <div className="relative h-[317px] w-full overflow-hidden">
                  <Image
                    src={product.imageSrc}
                    alt={product.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 490px"
                  />
                </div>
                <div className="flex flex-1 flex-col pt-3">
                  <p className="text-xs font-semibold tracking-wide text-[#a85a48] uppercase">
                    {product.badge}
                  </p>
                  <h2 className="mt-1 font-heading text-lg font-semibold text-[#3d2a24]">
                    {product.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#5c4038]">
                    {product.priceLabel}
                  </p>
                  <p className="text-base font-semibold text-[#3d2a24]">
                    {product.price}
                  </p>
                  {product.salePrice ? (
                    <>
                      <p className="mt-1 text-sm text-[#5c4038]">
                        {product.saleLabel}
                      </p>
                      <p className="text-base font-semibold text-[#a85a48]">
                        {product.salePrice}
                      </p>
                    </>
                  ) : null}
                  <div className="mt-4">
                    <CloneCta href={product.href}>{product.ctaLabel}</CloneCta>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <FeatureSplit
        title={
          shipping && shipping.type === 'split-block'
            ? shipping.title
            : glinaBoxPage.shipping.title
        }
        paragraphs={
          shipping && shipping.type === 'split-block'
            ? (shipping.paragraphs ?? [])
            : glinaBoxPage.shipping.paragraphs
        }
        bullets={
          shipping && shipping.type === 'split-block'
            ? (shipping.bullets ?? [])
            : glinaBoxPage.shipping.bullets
        }
        imageSrc={
          shipping && shipping.type === 'split-block'
            ? shipping.imageSrc
            : glinaBoxPage.shipping.imageSrc
        }
        imageAlt={
          shipping && shipping.type === 'split-block'
            ? shipping.imageAlt
            : glinaBoxPage.shipping.imageAlt
        }
        imageWidth={488}
        imageHeight={541}
        ctaLabel={
          shipping && shipping.type === 'split-block'
            ? (shipping.ctaLabel ?? '')
            : glinaBoxPage.shipping.ctaLabel
        }
        ctaHref={
          shipping && shipping.type === 'split-block'
            ? (shipping.ctaHref ?? '/sklep')
            : glinaBoxPage.shipping.ctaHref
        }
        imageFirst
      />
    </div>
  );
}
