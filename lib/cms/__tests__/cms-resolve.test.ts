import { describe, expect, it } from 'vitest';
import {
  clonePageDocumentSchema,
  fingerprintClonePageDocument,
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
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';
import {
  documentToArchivePage,
  documentToGallery,
  documentToHomepageServices,
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

  it('accepts mid-copy and bullet-list sections', () => {
    const doc = getStaticClonePage(cmsSlugFromRoute('/pracownia'));
    expect(doc?.sections.some((s) => s.type === 'mid-copy')).toBe(true);
    const firm = getStaticClonePage(cmsSlugFromRoute('/grupy-i-firmy'));
    expect(firm?.sections.some((s) => s.type === 'bullet-list')).toBe(true);
    expect(documentToMarketingParts(firm!)?.bulletLists.length).toBe(2);
    expect(documentToMarketingParts(doc!)?.midCopy?.badgeSrc).toBeTruthy();
  });
});

describe('static CMS registry', () => {
  it('registers core marketing, homepage, gallery and nested archives', () => {
    const slugs = listRegisteredStaticSlugs();
    for (const route of [
      '/',
      '/home',
      '/galeria',
      '/kontakt',
      '/glinadowina',
      '/urodziny',
      '/panienskie',
      '/pracownia',
      '/service-page/ceramika-dla-dorosłych-pon-czw',
      '/booking-calendar/glina-do-wina-piątek-19-00-suchy-las',
    ]) {
      const slug = cmsSlugFromRoute(route);
      expect(slugs).toContain(slug);
      const doc = getStaticClonePage(slug);
      expect(doc?.format).toBe('clone-page-v1');
      expect(doc?.cmsSlug).toBe(slug);
    }
  });

  it('adapts documents to existing view models without content loss', () => {
    const kontakt = getStaticClonePage(cmsSlugFromRoute('/kontakt'));
    expect(documentToArchivePage(kontakt!)?.sections.length).toBeGreaterThan(0);
    const glina = getStaticClonePage(cmsSlugFromRoute('/glinadowina'));
    const parts = documentToMarketingParts(glina!);
    expect(parts?.hero.title).toBeTruthy();
    expect(parts?.blocks.length).toBeGreaterThan(0);
    const home = getStaticClonePage(cmsSlugFromRoute('/'));
    expect(documentToHomepageServices(home!)?.services.length).toBe(11);
    const galeria = getStaticClonePage(cmsSlugFromRoute('/galeria'));
    expect(documentToGallery(galeria!)?.images.length).toBe(33);
  });

  it('fingerprints are stable for seed parity', () => {
    const doc = getStaticClonePage(cmsSlugFromRoute('/faq'))!;
    const a = fingerprintClonePageDocument(doc);
    const b = fingerprintClonePageDocument(
      parseClonePageDocument(serializeClonePageDocument(doc))!
    );
    expect(a).toBe(b);
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
