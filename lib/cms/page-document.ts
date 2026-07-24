import { z } from 'zod';

/**
 * Versioned structured page document stored in content_pages.content as JSON.
 * Presentation (layout, CSS, components) stays in the app — only content lives here.
 */
export const CLONE_PAGE_FORMAT = 'clone-page-v1' as const;

const ctaSchema = z.object({
  label: z.string().min(1).max(120),
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
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  tinted: z.boolean().optional(),
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

const sectionSchema = z.discriminatedUnion('type', [
  archiveSectionSchema,
  splitBlockSchema,
  heroSchema,
  paragraphListSchema,
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
  title: z.string(),
  metaDescription: z.string().optional(),
  provenance: z.object({
    sources: z.array(z.string()),
    importedAt: z.string().optional(),
  }),
  sections: z.array(sectionSchema),
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
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (href.startsWith('https://wa.me/')) return true;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    try {
      const u = new URL(href);
      return (
        u.hostname === 'www.ceramikanero.com' ||
        u.hostname === 'ceramikanero.com' ||
        u.hostname.endsWith('.ceramikanero.com')
      );
    } catch {
      return false;
    }
  }
  if (href.startsWith('/')) {
    return !/^\/(admin|api)\b/i.test(href);
  }
  return false;
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
  }
  return null;
}
