import type { ClonePageDocument } from '@/lib/cms/page-document';
import { registerStaticClonePage } from '@/lib/cms/resolve-page';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';
import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import type { ArchivePageData } from '@/components/clone/archive-page';
import {
  glinaDoWinaPage,
  homepageServices,
  galeriaImages,
} from '@/lib/clone/content/landings';
import {
  dlaDzieciPage,
  dlaDoroslychPage,
  dlaFirmPage,
} from '@/lib/clone/content/audience-pages';
import { pracowniaPage } from '@/lib/clone/content/pracownia';
import {
  glinaBoxPage,
  urodzinyPage,
  panienskiePage,
} from '@/lib/clone/content/glina-box-and-events';

function stamp(doc: Omit<ClonePageDocument, 'cmsSlug'>): ClonePageDocument {
  return {
    ...doc,
    cmsSlug: cmsSlugFromRoute(doc.route),
  };
}

function fromArchive(route: string): ClonePageDocument | null {
  const page = (archivePages as unknown as Record<string, ArchivePageData>)[
    route
  ];
  if (!page) return null;
  return stamp({
    format: 'clone-page-v1',
    template: 'archive',
    route,
    title: page.title,
    provenance: {
      sources: [
        `lib/clone/content/phase2/archive-pages.ts:${route}`,
        `reference/original-site/pages${route}`,
      ],
    },
    sections: page.sections.map((section) => ({
      type: 'archive-section' as const,
      heading: section.heading,
      text: section.text,
      images: section.images.map((img) => ({
        src: img.src,
        alt: img.alt,
        dims: img.dims,
      })),
      buttons: section.buttons
        .map((b) => ({
          label: b.label,
          href: b.href,
        }))
        // Drop archive noise anchors; public clone already filters these in link UI.
        .filter((b) => b.href && b.href !== '#' && !b.href.startsWith('#')),
    })),
  });
}

function fromMarketingSplit(
  route: string,
  page: {
    title: string;
    metaDescription: string;
    hero: {
      title: string;
      imageSrc: string;
      imageAlt: string;
      logoSrc?: string;
      logoAlt?: string;
      intro?: readonly string[];
    };
    blocks: readonly {
      id: string;
      title: string;
      subtitle?: string;
      paragraphs?: readonly string[];
      bullets?: readonly string[];
      imageSrc: string;
      imageAlt: string;
      imageFirst?: boolean;
      imageWidth?: number;
      imageHeight?: number;
      ctaLabel?: string;
      ctaHref?: string;
      tinted?: boolean;
      textAlign?: 'left' | 'center';
      framed?: boolean;
      compact?: boolean;
    }[];
  },
  sources: string[],
  extras: ClonePageDocument['sections'] = []
): ClonePageDocument {
  return stamp({
    format: 'clone-page-v1',
    template: 'marketing-split',
    route,
    title: page.title,
    metaDescription: page.metaDescription,
    provenance: { sources },
    sections: [
      {
        type: 'hero',
        title: page.hero.title,
        imageSrc: page.hero.imageSrc,
        imageAlt: page.hero.imageAlt,
        logoSrc: page.hero.logoSrc,
        logoAlt: page.hero.logoAlt,
        intro: page.hero.intro ? [...page.hero.intro] : undefined,
      },
      ...extras,
      ...page.blocks.map((block) => ({
        type: 'split-block' as const,
        id: block.id,
        title: block.title,
        subtitle: block.subtitle,
        paragraphs: block.paragraphs ? [...block.paragraphs] : undefined,
        bullets: block.bullets ? [...block.bullets] : undefined,
        imageSrc: block.imageSrc,
        imageAlt: block.imageAlt,
        imageFirst: block.imageFirst,
        imageWidth: block.imageWidth,
        imageHeight: block.imageHeight,
        ctaLabel: block.ctaLabel,
        ctaHref: block.ctaHref,
        tinted: block.tinted,
        textAlign: block.textAlign,
        framed: block.framed,
        compact: block.compact,
      })),
    ],
  });
}

function register(doc: ClonePageDocument | null): void {
  if (!doc) return;
  const slug = doc.cmsSlug ?? cmsSlugFromRoute(doc.route);
  registerStaticClonePage(slug, () => doc);
}

/** Register Phase 1/2 clone fixtures as CMS static fallbacks. */
export function registerAllStaticClonePages(): void {
  // All archive fixtures (nested service/booking/product/course/webinar included).
  for (const route of Object.keys(archivePages)) {
    register(fromArchive(route));
  }

  register(
    fromMarketingSplit('/glinadowina', glinaDoWinaPage, [
      'lib/clone/content/landings.ts#glinaDoWinaPage',
      'reference/original-site/pages/glinadowina',
    ])
  );
  register(
    fromMarketingSplit('/dla-dzieci', dlaDzieciPage, [
      'lib/clone/content/audience-pages.ts#dlaDzieciPage',
    ])
  );
  register(
    fromMarketingSplit('/dla-doroslych', dlaDoroslychPage, [
      'lib/clone/content/audience-pages.ts#dlaDoroslychPage',
    ])
  );
  register(
    fromMarketingSplit(
      '/grupy-i-firmy',
      dlaFirmPage,
      ['lib/clone/content/audience-pages.ts#dlaFirmPage'],
      [
        {
          type: 'bullet-list',
          id: 'intro-bullets',
          heading: null,
          bullets: [...dlaFirmPage.introBullets],
        },
        {
          type: 'bullet-list',
          id: 'who-bullets',
          heading: dlaFirmPage.whoHeading,
          bullets: [...dlaFirmPage.whoBullets],
          footerNote: 'Dostępne pakiety:',
        },
      ]
    )
  );
  register(
    fromMarketingSplit(
      '/pracownia',
      pracowniaPage,
      ['lib/clone/content/pracownia.ts'],
      [
        {
          type: 'mid-copy',
          workshopsHeading: pracowniaPage.midCopy.workshopsHeading,
          workshopsBody: pracowniaPage.midCopy.workshopsBody,
          contactHeading: pracowniaPage.midCopy.contactHeading,
          contactBody: pracowniaPage.midCopy.contactBody,
          badgeSrc: pracowniaPage.midCopy.badgeSrc,
          badgeAlt: pracowniaPage.midCopy.badgeAlt,
          packagesLabel: 'Dostępne warsztaty:',
        },
      ]
    )
  );
  register(
    fromMarketingSplit(
      '/urodziny',
      urodzinyPage,
      ['lib/clone/content/glina-box-and-events.ts#urodzinyPage'],
      [
        {
          type: 'offer-intro',
          heading: urodzinyPage.offerIntro.heading,
          paragraphs: [...urodzinyPage.offerIntro.paragraphs],
        },
      ]
    )
  );
  register(
    fromMarketingSplit('/panienskie', panienskiePage, [
      'lib/clone/content/glina-box-and-events.ts#panienskiePage',
    ])
  );

  register(
    stamp({
      format: 'clone-page-v1',
      template: 'gallery',
      route: '/galeria',
      title: 'Galeria | Pracownia Ceramiki N',
      metaDescription:
        'Galeria prac i warsztatów Pracowni Ceramiki Nero — oryginalny zestaw zdjęć ze strony Galeria.',
      provenance: {
        sources: [
          'lib/clone/content/landings.ts#galeriaImages',
          'app/galeria/page.tsx',
        ],
      },
      sections: [
        {
          type: 'hero',
          title: 'Rękodzieło jako joga umysłu',
          imageSrc:
            '/images/wix-migrated/747d6f_b6b2ebdcb95f424984ee80e8e58a604d.jpg',
          imageAlt: 'iStock-1302287658 kopia.jpg',
          logoSrc:
            '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png',
          logoAlt: 'warsztaty ceramiczne, sklep z ceramika',
          intro: ['Galeria', 'Moja pasja ... w obiektywie aparatu.'],
        },
        {
          type: 'gallery-grid',
          images: galeriaImages.map((img) => ({
            src: img.src,
            alt: img.alt,
          })),
        },
      ],
    })
  );

  register(
    stamp({
      format: 'clone-page-v1',
      template: 'homepage-services',
      route: '/',
      title: 'Ceramika Nero | warsztaty z ceramiki Poznań',
      metaDescription:
        'Wybierz warsztat i zarezerwuj dogodny termin w Pracowni Ceramiki Nero — Suchy Las / Poznań.',
      provenance: {
        sources: [
          'lib/clone/content/landings.ts#homepageServices',
          'app/page.tsx',
        ],
      },
      sections: [
        {
          type: 'homepage-header',
          title: 'Wybierz warsztat',
          subtitle: 'Zobacz terminy',
          chips: [
            'Wszystkie usługi',
            'CERAMIKA NERO PODGÓRNA 3 SUCHY LAS',
            'Inne lokalizacje',
          ],
        },
        ...homepageServices.map((service, index) => ({
          type: 'service-card' as const,
          id: `svc-${index}`,
          title: service.title,
          day: service.day,
          price: service.price,
          imageSrc: service.image,
          imageAlt: service.imageAlt,
          moreHref: service.moreHref,
          href: service.href,
          cta: service.cta,
          soldOut: 'soldOut' in service ? service.soldOut : undefined,
          venueKey: service.venueKey,
        })),
      ],
    })
  );

  register(
    stamp({
      format: 'clone-page-v1',
      template: 'glina-box',
      route: '/home',
      title: glinaBoxPage.title,
      metaDescription: glinaBoxPage.metaDescription,
      provenance: {
        sources: [
          'lib/clone/content/glina-box-and-events.ts#glinaBoxPage',
          'app/home/page.tsx',
        ],
      },
      sections: [
        {
          type: 'hero',
          title: glinaBoxPage.hero.title,
          imageSrc: glinaBoxPage.hero.imageSrc,
          imageAlt: glinaBoxPage.hero.imageAlt,
          logoSrc: glinaBoxPage.hero.logoSrc,
          intro: [...glinaBoxPage.hero.intro],
        },
        {
          type: 'paragraphs',
          paragraphs: [...glinaBoxPage.introBlocks],
        },
        {
          type: 'labeled-image',
          id: 'gift-banner',
          src: glinaBoxPage.giftBannerSrc,
          alt: glinaBoxPage.giftBannerAlt,
        },
        {
          type: 'cta-block',
          id: 'primary-cta',
          label: glinaBoxPage.primaryCta.label,
          href: glinaBoxPage.primaryCta.href,
        },
        {
          type: 'labeled-image',
          id: 'strip-banner',
          src: glinaBoxPage.bannerSrc,
          alt: '',
          decorative: true,
        },
        {
          type: 'split-block',
          id: 'breath',
          title: glinaBoxPage.breath.title,
          paragraphs: [...glinaBoxPage.breath.paragraphs],
          bullets: [...glinaBoxPage.breath.bullets],
          imageSrc: glinaBoxPage.breath.imageSrc,
          imageAlt: glinaBoxPage.breath.imageAlt,
          imageFirst: true,
          ctaLabel: glinaBoxPage.breath.ctaLabel,
          ctaHref: glinaBoxPage.breath.ctaHref,
        },
        {
          type: 'split-block',
          id: 'course',
          title: glinaBoxPage.course.title,
          paragraphs: [...glinaBoxPage.course.paragraphs],
          bullets: [...glinaBoxPage.course.bullets],
          imageSrc: glinaBoxPage.course.imageSrc,
          imageAlt: glinaBoxPage.course.imageAlt,
          imageFirst: false,
          ctaLabel: glinaBoxPage.course.ctaLabel,
          ctaHref: glinaBoxPage.course.ctaHref,
        },
        ...glinaBoxPage.products.map((product) => ({
          type: 'product-card' as const,
          id: product.id,
          badge: product.badge,
          title: product.title,
          priceLabel: product.priceLabel,
          price: product.price,
          saleLabel: 'saleLabel' in product ? product.saleLabel : undefined,
          salePrice: 'salePrice' in product ? product.salePrice : undefined,
          href: product.href,
          imageSrc: product.imageSrc,
          imageAlt: product.imageAlt,
          ctaLabel: product.ctaLabel,
        })),
        {
          type: 'split-block',
          id: 'shipping',
          title: glinaBoxPage.shipping.title,
          paragraphs: [...glinaBoxPage.shipping.paragraphs],
          bullets: [...glinaBoxPage.shipping.bullets],
          imageSrc: glinaBoxPage.shipping.imageSrc,
          imageAlt: glinaBoxPage.shipping.imageAlt,
          ctaLabel: glinaBoxPage.shipping.ctaLabel,
          ctaHref: glinaBoxPage.shipping.ctaHref,
        },
      ],
    })
  );
}

// Side-effect registration for server imports.
registerAllStaticClonePages();
