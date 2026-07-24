import type { ClonePageDocument } from '@/lib/cms/page-document';
import { registerStaticClonePage } from '@/lib/cms/resolve-page';
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
import { glinaBoxPage } from '@/lib/clone/content/glina-box-and-events';

function fromArchive(route: string): ClonePageDocument | null {
  const page = (archivePages as unknown as Record<string, ArchivePageData>)[
    route
  ];
  if (!page) return null;
  return {
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
      buttons: section.buttons.map((b) => ({
        label: b.label,
        href: b.href,
      })),
    })),
  };
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
      ctaLabel?: string;
      ctaHref?: string;
      tinted?: boolean;
    }[];
  },
  sources: string[]
): ClonePageDocument {
  return {
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
        ctaLabel: block.ctaLabel,
        ctaHref: block.ctaHref,
        tinted: block.tinted,
      })),
    ],
  };
}

/** Register Phase 1/2 clone fixtures as CMS static fallbacks. */
export function registerAllStaticClonePages(): void {
  registerStaticClonePage('kontakt', () => fromArchive('/kontakt'));
  registerStaticClonePage('faq', () => fromArchive('/faq'));
  registerStaticClonePage('regulamin', () => fromArchive('/regulamin'));
  registerStaticClonePage('terms-conditions', () =>
    fromArchive('/terms-conditions')
  );
  registerStaticClonePage('dostawy-i-zwroty', () =>
    fromArchive('/dostawy-i-zwroty')
  );
  registerStaticClonePage('sklep', () => fromArchive('/sklep'));
  registerStaticClonePage('vouchery', () => fromArchive('/vouchery'));
  registerStaticClonePage('gift-card', () => fromArchive('/gift-card'));
  registerStaticClonePage('cart', () => fromArchive('/cart'));
  registerStaticClonePage('services', () => fromArchive('/services'));

  for (const route of Object.keys(archivePages)) {
    const slug = route.replace(/^\//, '');
    if (!slug || slug.includes('/')) continue;
    registerStaticClonePage(slug, () => fromArchive(route));
  }

  registerStaticClonePage('glinadowina', () =>
    fromMarketingSplit('/glinadowina', glinaDoWinaPage, [
      'lib/clone/content/landings.ts#glinaDoWinaPage',
      'reference/original-site/pages/glinadowina',
    ])
  );
  registerStaticClonePage('dla-dzieci', () =>
    fromMarketingSplit('/dla-dzieci', dlaDzieciPage, [
      'lib/clone/content/audience-pages.ts#dlaDzieciPage',
    ])
  );
  registerStaticClonePage('dla-doroslych', () =>
    fromMarketingSplit('/dla-doroslych', dlaDoroslychPage, [
      'lib/clone/content/audience-pages.ts#dlaDoroslychPage',
    ])
  );
  registerStaticClonePage('grupy-i-firmy', () =>
    fromMarketingSplit('/grupy-i-firmy', dlaFirmPage, [
      'lib/clone/content/audience-pages.ts#dlaFirmPage',
    ])
  );
  registerStaticClonePage('pracownia', () =>
    fromMarketingSplit('/pracownia', pracowniaPage, [
      'lib/clone/content/pracownia.ts',
    ])
  );

  registerStaticClonePage('galeria', () => ({
    format: 'clone-page-v1',
    template: 'gallery',
    route: '/galeria',
    title: 'Galeria | Pracownia Ceramiki N',
    provenance: {
      sources: ['lib/clone/content/landings.ts#galeriaImages'],
    },
    sections: [
      {
        type: 'paragraphs',
        paragraphs: [
          'Rękodzieło jako joga umysłu',
          'Moja pasja ... w obiektywie aparatu.',
        ],
      },
      ...galeriaImages.map((img) => ({
        type: 'archive-section' as const,
        heading: null as string | null,
        text: '',
        images: [{ src: img.src, alt: img.alt }],
        buttons: [] as { label: string; href: string }[],
      })),
    ],
  }));

  registerStaticClonePage('home', () => ({
    format: 'clone-page-v1',
    template: 'glina-box',
    route: '/home',
    title: glinaBoxPage.title,
    metaDescription: glinaBoxPage.metaDescription,
    provenance: {
      sources: ['lib/clone/content/glina-box-and-events.ts#glinaBoxPage'],
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
    ],
  }));

  registerStaticClonePage('_homepage-services', () => ({
    format: 'clone-page-v1',
    template: 'homepage-services',
    route: '/',
    title: 'Wybierz warsztat',
    provenance: {
      sources: ['lib/clone/content/landings.ts#homepageServices'],
    },
    sections: homepageServices.map((service, index) => ({
      type: 'split-block' as const,
      id: `svc-${index}`,
      title: service.title,
      paragraphs: [service.price, service.day].filter(Boolean) as string[],
      imageSrc: service.image,
      imageAlt: service.imageAlt,
      ctaLabel: service.cta,
      ctaHref: service.href,
    })),
  }));
}

// Side-effect registration for server imports.
registerAllStaticClonePages();
