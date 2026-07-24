import { describe, expect, it } from 'vitest';
import {
  clonePageDocumentSchema,
  isSafeInternalHref,
  parseClonePageDocument,
  serializeClonePageDocument,
  validateClonePageContentForSave,
} from '@/lib/cms/page-document';
import '@/lib/cms/static-registry';
import {
  getStaticClonePage,
  listRegisteredStaticSlugs,
} from '@/lib/cms/resolve-page';
import {
  documentToArchivePage,
  documentToMarketingParts,
} from '@/lib/cms/document-adapters';
import { mobileContactTargets } from '@/components/layout/mobile-contact-fab';

describe('clone-page-v1 document', () => {
  it('round-trips a minimal archive document', () => {
    const doc = {
      format: 'clone-page-v1' as const,
      template: 'archive' as const,
      route: '/kontakt',
      title: 'Kontakt',
      provenance: { sources: ['test'] },
      sections: [
        {
          type: 'archive-section' as const,
          heading: 'Hello',
          text: 'Akapit.\n\n■ punkt',
          images: [],
          buttons: [{ label: 'Mail', href: 'mailto:a@b.c' }],
        },
      ],
    };
    const raw = serializeClonePageDocument(doc);
    const parsed = parseClonePageDocument(raw);
    expect(parsed).toEqual(doc);
    expect(clonePageDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects unsafe external hrefs for admin saves', () => {
    expect(isSafeInternalHref('/kontakt')).toBe(true);
    expect(isSafeInternalHref('mailto:x@y.z')).toBe(true);
    expect(isSafeInternalHref('https://wa.me/48532279101')).toBe(true);
    expect(isSafeInternalHref('/admin/warsztaty')).toBe(false);
    expect(isSafeInternalHref('https://evil.example')).toBe(false);
  });

  it('validateClonePageContentForSave rejects bad CTA hrefs', () => {
    const bad = serializeClonePageDocument({
      format: 'clone-page-v1',
      template: 'archive',
      route: '/kontakt',
      title: 'Kontakt',
      provenance: { sources: ['test'] },
      sections: [
        {
          type: 'archive-section',
          heading: null,
          text: 'x',
          images: [],
          buttons: [{ label: 'X', href: 'https://evil.example' }],
        },
      ],
    });
    expect(validateClonePageContentForSave(bad)).toMatch(/Niedozwolony link/);
    expect(validateClonePageContentForSave('plain markdown')).toBeNull();
  });
});

describe('static CMS registry', () => {
  it('registers core marketing and archive pages', () => {
    const slugs = listRegisteredStaticSlugs();
    for (const slug of [
      'kontakt',
      'glinadowina',
      'dla-dzieci',
      'dla-doroslych',
      'grupy-i-firmy',
      'pracownia',
    ]) {
      expect(slugs).toContain(slug);
      const doc = getStaticClonePage(slug);
      expect(doc?.format).toBe('clone-page-v1');
      expect(doc?.route.replace(/^\//, '')).toBe(slug);
    }
  });

  it('adapts archive and marketing documents to existing view models', () => {
    const kontakt = getStaticClonePage('kontakt');
    expect(documentToArchivePage(kontakt!)?.sections.length).toBeGreaterThan(0);
    const glina = getStaticClonePage('glinadowina');
    const parts = documentToMarketingParts(glina!);
    expect(parts?.hero.title).toBeTruthy();
    expect(parts?.blocks.length).toBeGreaterThan(0);
  });
});

describe('mobile contact FAB targets', () => {
  it('uses archive-verified phone and wa.me digits only', () => {
    expect(mobileContactTargets.tel).toBe('tel:+48532279101');
    expect(mobileContactTargets.whatsapp).toBe('https://wa.me/48532279101');
    expect(mobileContactTargets.whatsappWithMessage).toContain(
      'text=Dzie%C5%84'
    );
    expect(mobileContactTargets.display).toBe('532 279 101');
    expect(mobileContactTargets.provenance).toMatch(/navigation/);
  });
});
