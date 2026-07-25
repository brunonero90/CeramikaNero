import { describe, expect, it } from 'vitest';
import { homepageServices } from '@/lib/clone/content/landings';
import {
  dlaDzieciPage,
  dlaDoroslychPage,
} from '@/lib/clone/content/audience-pages';
import { resolveCtaHref } from '@/lib/clone/link-resolve';

describe('booking CTA destinations', () => {
  it('homepage service book CTAs are first-party or contact', () => {
    for (const service of homepageServices) {
      if (!('href' in service) || !service.href) continue;
      expect(service.href.startsWith('/')).toBe(true);
      expect(service.href).not.toMatch(/booking-calendar/);
      if (/zarezerwuj/i.test(service.cta)) {
        expect(
          service.href.includes('/rezerwacja') ||
            service.href === '/kontakt' ||
            service.href.startsWith('/service-page/')
        ).toBe(true);
      }
    }
  });

  it('audience Rezerwuj termin CTAs are not dead home links', () => {
    for (const block of [...dlaDzieciPage.blocks, ...dlaDoroslychPage.blocks]) {
      if (!block.ctaHref || !block.ctaLabel) continue;
      const resolved = resolveCtaHref(block.ctaLabel, block.ctaHref);
      if (!resolved.actionable) continue;
      if (/rezerwuj/i.test(block.ctaLabel)) {
        expect(resolved.href).not.toBe('/');
        expect(resolved.href).not.toBe('#');
        expect(resolved.href).not.toMatch(/booking-calendar/);
      }
    }
  });
});
