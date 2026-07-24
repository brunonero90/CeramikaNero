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
        ctaLabel: s.ctaLabel,
        ctaHref: s.ctaHref,
        tinted: s.tinted,
      };
    });
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
  };
}
