import { z } from 'zod';

/**
 * Versioned structured page document stored in content_pages.content as JSON.
 * Presentation (layout, CSS, components) stays in the app — only content lives here.
 *
 * Format: clone-page-v1 (additive section types; no DB schema migration).
 */
export const CLONE_PAGE_FORMAT = 'clone-page-v1' as const;

const ctaSchema = z.object({
  label: z.string().min(1).max(300),
  href: z.string().min(1).max(500),
});

const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string().default(''),
  dims: z.string().optional(),
});

const archiveSectionSchema = z.object({
  type: z.literal('archive-section'),
  heading: z.string().nullable(),
  text: z.string(),
  images: z.array(imageSchema).default([]),
  buttons: z.array(ctaSchema).default([]),
});

const splitBlockSchema = z.object({
  type: z.literal('split-block'),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  paragraphs: z.array(z.string()).optional(),
  bullets: z.array(z.string()).optional(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  imageFirst: z.boolean().optional(),
  imageWidth: z.number().optional(),
  imageHeight: z.number().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  tinted: z.boolean().optional(),
  textAlign: z.enum(['left', 'center']).optional(),
  framed: z.boolean().optional(),
  compact: z.boolean().optional(),
});

const heroSchema = z.object({
  type: z.literal('hero'),
  title: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  logoSrc: z.string().optional(),
  logoAlt: z.string().optional(),
  intro: z.array(z.string()).optional(),
});

const paragraphListSchema = z.object({
  type: z.literal('paragraphs'),
  paragraphs: z.array(z.string()),
});

/** Pracownia mid-page chrome previously kept only in JSX. */
const midCopySchema = z.object({
  type: z.literal('mid-copy'),
  workshopsHeading: z.string(),
  workshopsBody: z.string(),
  contactHeading: z.string(),
  contactBody: z.string(),
  badgeSrc: z.string(),
  badgeAlt: z.string(),
  packagesLabel: z.string().optional(),
});

/** Ordered bullet lists (grupy-i-firmy intro/who, etc.). */
const bulletListSchema = z.object({
  type: z.literal('bullet-list'),
  id: z.string(),
  heading: z.string().nullable(),
  bullets: z.array(z.string()),
  footerNote: z.string().optional(),
});

/** Urodziny “Co oferujemy?” block. */
const offerIntroSchema = z.object({
  type: z.literal('offer-intro'),
  heading: z.string(),
  paragraphs: z.array(z.string()),
});

const labeledImageSchema = z.object({
  type: z.literal('labeled-image'),
  id: z.string(),
  src: z.string(),
  alt: z.string(),
  decorative: z.boolean().optional(),
});

const ctaBlockSchema = z.object({
  type: z.literal('cta-block'),
  id: z.string(),
  label: z.string(),
  href: z.string(),
});

const productCardSchema = z.object({
  type: z.literal('product-card'),
  id: z.string(),
  badge: z.string().optional(),
  title: z.string(),
  priceLabel: z.string(),
  price: z.string(),
  saleLabel: z.string().optional(),
  salePrice: z.string().optional(),
  href: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  ctaLabel: z.string(),
});

const homepageHeaderSchema = z.object({
  type: z.literal('homepage-header'),
  title: z.string(),
  subtitle: z.string(),
  chips: z.array(z.string()),
});

const serviceCardSchema = z.object({
  type: z.literal('service-card'),
  id: z.string(),
  title: z.string(),
  day: z.string(),
  price: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  moreHref: z.string(),
  href: z.string(),
  cta: z.string(),
  soldOut: z.boolean().optional(),
  venueKey: z.enum(['suchy-las', 'ptasie-radio', 'enquiry']).optional(),
});

const galleryGridSchema = z.object({
  type: z.literal('gallery-grid'),
  images: z.array(imageSchema),
});

const sectionSchema = z.discriminatedUnion('type', [
  archiveSectionSchema,
  splitBlockSchema,
  heroSchema,
  paragraphListSchema,
  midCopySchema,
  bulletListSchema,
  offerIntroSchema,
  labeledImageSchema,
  ctaBlockSchema,
  productCardSchema,
  homepageHeaderSchema,
  serviceCardSchema,
  galleryGridSchema,
]);

export const clonePageDocumentSchema = z.object({
  format: z.literal(CLONE_PAGE_FORMAT),
  template: z.enum([
    'archive',
    'marketing-split',
    'homepage-services',
    'gallery',
    'glina-box',
  ]),
  route: z.string().startsWith('/'),
  /** ASCII content_pages.slug (nested routes use hyphen encoding). */
  cmsSlug: z.string().optional(),
  title: z.string(),
  metaDescription: z.string().optional(),
  provenance: z.object({
    sources: z.array(z.string()),
    importedAt: z.string().optional(),
  }),
  sections: z.array(sectionSchema),
  /** Reference only — never embed operational workshop/session fields. */
  workshopSlugRef: z.string().nullable().optional(),
});

export type ClonePageDocument = z.infer<typeof clonePageDocumentSchema>;
export type ClonePageSection = z.infer<typeof sectionSchema>;

export function parseClonePageDocument(
  raw: string | null | undefined
): ClonePageDocument | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = clonePageDocumentSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function serializeClonePageDocument(doc: ClonePageDocument): string {
  return JSON.stringify(doc, null, 0);
}

/** Reject unsafe destinations before saving from admin. */
export function isSafeInternalHref(href: string): boolean {
  if (!href || href === '#' || href.startsWith('#')) return false;
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (href.startsWith('https://wa.me/')) return true;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const cleaned = href.replace(/[.;]+$/g, '');
      const u = new URL(cleaned);
      const host = u.hostname.replace(/^www\./, '');
      const allowedExternal = new Set([
        'ceramikanero.com',
        'trosca.pl',
        'uokik.gov.pl',
        'ec.europa.eu',
      ]);
      if (
        allowedExternal.has(host) ||
        host.endsWith('.ceramikanero.com') ||
        host.endsWith('.uokik.gov.pl') ||
        host.endsWith('.europa.eu')
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  if (href.startsWith('/')) {
    return !/^\/(admin|api)\b/i.test(href);
  }
  return false;
}

function collectHrefIssues(doc: ClonePageDocument): string | null {
  for (const section of doc.sections) {
    if (section.type === 'archive-section') {
      for (const button of section.buttons) {
        if (button.href && !isSafeInternalHref(button.href)) {
          return `Niedozwolony link CTA: ${button.href}`;
        }
      }
    }
    if (section.type === 'split-block' && section.ctaHref) {
      if (!isSafeInternalHref(section.ctaHref)) {
        return `Niedozwolony link CTA: ${section.ctaHref}`;
      }
    }
    if (section.type === 'cta-block' && !isSafeInternalHref(section.href)) {
      return `Niedozwolony link CTA: ${section.href}`;
    }
    if (section.type === 'product-card' && !isSafeInternalHref(section.href)) {
      return `Niedozwolony link produktu: ${section.href}`;
    }
    if (section.type === 'service-card') {
      if (
        !isSafeInternalHref(section.href) ||
        !isSafeInternalHref(section.moreHref)
      ) {
        return `Niedozwolony link karty usług: ${section.href}`;
      }
    }
  }
  return null;
}

/** Validate clone-page-v1 JSON before admin save. Returns null when OK. */
export function validateClonePageContentForSave(
  raw: string | null | undefined
): string | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.includes(CLONE_PAGE_FORMAT)) {
    return null;
  }
  const doc = parseClonePageDocument(trimmed);
  if (!doc) {
    return 'Treść CMS ma nieprawidłowy format clone-page-v1.';
  }
  return collectHrefIssues(doc);
}

/** Stable content fingerprint for static↔CMS parity (order-sensitive). */
export function fingerprintClonePageDocument(doc: ClonePageDocument): string {
  return JSON.stringify({
    format: doc.format,
    template: doc.template,
    route: doc.route,
    title: doc.title,
    metaDescription: doc.metaDescription ?? null,
    sections: doc.sections,
  });
}
