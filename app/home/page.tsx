import Image from 'next/image';
import Link from 'next/link';
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

      <section className="mx-auto max-w-3xl px-4 pb-10 text-center md:px-6">
        {introBlocks.map((p) => (
          <p
            key={p.slice(0, 48)}
            className="mt-4 text-base leading-relaxed text-text-muted first:mt-0 md:text-lg"
          >
            {p}
          </p>
        ))}
        <div className="mx-auto mt-8 max-w-xl">
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
            className="mx-auto h-auto w-full object-contain"
          />
          <p className="sr-only">WYJĄTKOWY PREZENT</p>
        </div>
        <div className="mt-8">
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
        <div className="mt-8">
          <Image
            src={
              strip && strip.type === 'labeled-image'
                ? strip.src
                : glinaBoxPage.bannerSrc
            }
            alt=""
            width={737}
            height={73}
            className="mx-auto h-auto w-full max-w-3xl object-contain"
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
        className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-14 md:px-6"
      >
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {products.map((product) => {
            if (product.type !== 'product-card') return null;
            return (
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
                  {product.salePrice ? (
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
