import type { ArchivePageData } from '@/components/clone/archive-page';
import type { SplitBlock } from '@/components/clone/marketing';
import type { ClonePageDocument } from '@/lib/cms/page-document';

/** Map CMS document back to ArchivePageData for existing ArchivePageView. */
export function documentToArchivePage(
  doc: ClonePageDocument
): ArchivePageData | null {
  if (doc.template !== 'archive') return null;
  return {
    title: doc.title,
    route: doc.route,
    sections: doc.sections
      .filter((s) => s.type === 'archive-section')
      .map((s) => {
        if (s.type !== 'archive-section') {
          throw new Error('unreachable');
        }
        return {
          heading: s.heading,
          text: s.text,
          images: s.images,
          buttons: s.buttons,
        };
      }),
  };
}

export function documentToMarketingParts(doc: ClonePageDocument): {
  hero: {
    title: string;
    imageSrc: string;
    imageAlt: string;
    logoSrc?: string;
    logoAlt?: string;
    intro?: string[];
  };
  blocks: SplitBlock[];
  midCopy?: {
    workshopsHeading: string;
    workshopsBody: string;
    contactHeading: string;
    contactBody: string;
    badgeSrc: string;
    badgeAlt: string;
    packagesLabel?: string;
  };
  bulletLists: {
    id: string;
    heading: string | null;
    bullets: string[];
    footerNote?: string;
  }[];
  offerIntro?: {
    heading: string;
    paragraphs: string[];
  };
} | null {
  if (doc.template !== 'marketing-split') return null;
  const hero = doc.sections.find((s) => s.type === 'hero');
  if (!hero || hero.type !== 'hero') return null;
  const blocks: SplitBlock[] = doc.sections
    .filter((s) => s.type === 'split-block')
    .map((s) => {
      if (s.type !== 'split-block') throw new Error('unreachable');
      return {
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        paragraphs: s.paragraphs,
        bullets: s.bullets,
        imageSrc: s.imageSrc,
        imageAlt: s.imageAlt,
        imageFirst: s.imageFirst,
        imageWidth: s.imageWidth,
        imageHeight: s.imageHeight,
        ctaLabel: s.ctaLabel,
        ctaHref: s.ctaHref,
        tinted: s.tinted,
        textAlign: s.textAlign,
        framed: s.framed,
        compact: s.compact,
      };
    });
  const mid = doc.sections.find((s) => s.type === 'mid-copy');
  const offer = doc.sections.find((s) => s.type === 'offer-intro');
  return {
    hero: {
      title: hero.title,
      imageSrc: hero.imageSrc,
      imageAlt: hero.imageAlt,
      logoSrc: hero.logoSrc,
      logoAlt: hero.logoAlt,
      intro: hero.intro,
    },
    blocks,
    midCopy:
      mid && mid.type === 'mid-copy'
        ? {
            workshopsHeading: mid.workshopsHeading,
            workshopsBody: mid.workshopsBody,
            contactHeading: mid.contactHeading,
            contactBody: mid.contactBody,
            badgeSrc: mid.badgeSrc,
            badgeAlt: mid.badgeAlt,
            packagesLabel: mid.packagesLabel,
          }
        : undefined,
    bulletLists: doc.sections
      .filter((s) => s.type === 'bullet-list')
      .map((s) => {
        if (s.type !== 'bullet-list') throw new Error('unreachable');
        return {
          id: s.id,
          heading: s.heading,
          bullets: s.bullets,
          footerNote: s.footerNote,
        };
      }),
    offerIntro:
      offer && offer.type === 'offer-intro'
        ? { heading: offer.heading, paragraphs: offer.paragraphs }
        : undefined,
  };
}

export function documentToHomepageServices(doc: ClonePageDocument): {
  header: { title: string; subtitle: string; chips: string[] };
  services: {
    id: string;
    title: string;
    day: string;
    price: string;
    image: string;
    imageAlt: string;
    moreHref: string;
    href: string;
    cta: string;
    soldOut?: boolean;
  }[];
} | null {
  if (doc.template !== 'homepage-services') return null;
  const header = doc.sections.find((s) => s.type === 'homepage-header');
  if (!header || header.type !== 'homepage-header') return null;
  return {
    header: {
      title: header.title,
      subtitle: header.subtitle,
      chips: header.chips,
    },
    services: doc.sections
      .filter((s) => s.type === 'service-card')
      .map((s) => {
        if (s.type !== 'service-card') throw new Error('unreachable');
        return {
          id: s.id,
          title: s.title,
          day: s.day,
          price: s.price,
          image: s.imageSrc,
          imageAlt: s.imageAlt,
          moreHref: s.moreHref,
          href: s.href,
          cta: s.cta,
          soldOut: s.soldOut,
        };
      }),
  };
}

export function documentToGallery(doc: ClonePageDocument): {
  hero: {
    title: string;
    imageSrc: string;
    imageAlt: string;
    logoSrc?: string;
    logoAlt?: string;
    intro?: string[];
  };
  images: { src: string; alt: string }[];
} | null {
  if (doc.template !== 'gallery') return null;
  const hero = doc.sections.find((s) => s.type === 'hero');
  const grid = doc.sections.find((s) => s.type === 'gallery-grid');
  if (!hero || hero.type !== 'hero' || !grid || grid.type !== 'gallery-grid') {
    return null;
  }
  return {
    hero: {
      title: hero.title,
      imageSrc: hero.imageSrc,
      imageAlt: hero.imageAlt,
      logoSrc: hero.logoSrc,
      logoAlt: hero.logoAlt,
      intro: hero.intro,
    },
    images: grid.images.map((img) => ({ src: img.src, alt: img.alt })),
  };
}

export function documentToGlinaBox(doc: ClonePageDocument) {
  if (doc.template !== 'glina-box') return null;
  const hero = doc.sections.find((s) => s.type === 'hero');
  if (!hero || hero.type !== 'hero') return null;
  return {
    hero: {
      title: hero.title,
      imageSrc: hero.imageSrc,
      imageAlt: hero.imageAlt,
      logoSrc: hero.logoSrc,
      intro: hero.intro ?? [],
    },
    introBlocks:
      doc.sections.find((s) => s.type === 'paragraphs' && true)?.type ===
      'paragraphs'
        ? (
            doc.sections.find((s) => s.type === 'paragraphs') as {
              paragraphs: string[];
            }
          ).paragraphs
        : [],
    labeledImages: doc.sections.filter((s) => s.type === 'labeled-image'),
    ctas: doc.sections.filter((s) => s.type === 'cta-block'),
    splits: doc.sections.filter((s) => s.type === 'split-block'),
    products: doc.sections.filter((s) => s.type === 'product-card'),
  };
}
