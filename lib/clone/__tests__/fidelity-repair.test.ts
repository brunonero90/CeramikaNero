import { describe, expect, it } from 'vitest';
import {
  looksCollapsed,
  parseArchiveText,
} from '@/lib/clone/parse-archive-text';
import {
  isActionableCta,
  localizeHref,
  resolveCtaHref,
} from '@/lib/clone/link-resolve';
import { getArchivePage } from '@/lib/clone/archive';
import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import { homepageServices } from '@/lib/clone/content/landings';

describe('parseArchiveText', () => {
  it('splits blank-line paragraphs', () => {
    const blocks = parseArchiveText('Pierwszy akapit.\n\nDrugi akapit.');
    expect(blocks.filter((b) => b.type === 'paragraph')).toHaveLength(2);
  });

  it('extracts ■ bullet lists', () => {
    const blocks = parseArchiveText(
      'Oferta:\n\n■ pierwszy\n■ drugi\n\nKoniec.'
    );
    const list = blocks.find((b) => b.type === 'list');
    expect(list).toBeTruthy();
    if (list?.type === 'list') {
      expect(list.items).toEqual(['pierwszy', 'drugi']);
    }
  });

  it('extracts numbered steps', () => {
    const blocks = parseArchiveText('1. Krok A\n2. Krok B');
    const list = blocks.find((b) => b.type === 'list');
    expect(list?.type).toBe('list');
    if (list?.type === 'list') {
      expect(list.ordered).toBe(true);
      expect(list.items).toHaveLength(2);
    }
  });

  it('detects package-style headings', () => {
    const blocks = parseArchiveText('PAKIET STANDARD\n\nOpis pakietu.');
    expect(blocks.some((b) => b.type === 'heading')).toBe(true);
  });

  it('fails collapsed multi-paragraph detection for structured text', () => {
    const raw =
      'Akapit jeden.\n\nAkapit dwa.\n\n■ punkt\n■ punkt dwa\n\nKoniec tekstu.';
    expect(looksCollapsed(raw)).toBe(false);
    expect(parseArchiveText(raw).length).toBeGreaterThanOrEqual(3);
  });
});

describe('link resolve', () => {
  it('localizes ceramikanero.com URLs', () => {
    expect(localizeHref('https://www.ceramikanero.com/kontakt')).toBe(
      '/kontakt'
    );
  });

  it('rejects empty and hash anchors as non-actionable', () => {
    expect(resolveCtaHref('Zapisz się teraz', '#').actionable).toBe(false);
    expect(isActionableCta('Something', '#')).toBe(false);
  });

  it('rejects Wix accordion "Więcej szczegółów" even when href is /', () => {
    expect(resolveCtaHref('Więcej szczegółów...', '/').actionable).toBe(false);
  });

  it('maps privacy blob buttons to terms', () => {
    const long =
      'Zapisując się do newslettera, wyrażasz zgodę na przesyłanie Ci informacji o nowościach, promocjach i produktach w sklepie Ceramika Nero. Administratorem Twoich danych osobowych będzie Małgorzata Nero,';
    expect(resolveCtaHref(long, '/terms-conditions').href).toBe(
      '/terms-conditions'
    );
  });

  it('blocks excluded template paths', () => {
    expect(localizeHref('/services/manicure')).toBe('/');
  });
});

describe('archive fixture integrity', () => {
  it('archive pages have multi-block text where blank lines exist', () => {
    const routes = Object.keys(archivePages);
    expect(routes.length).toBeGreaterThan(20);
    let checked = 0;
    for (const route of routes) {
      const page = archivePages[route as keyof typeof archivePages];
      for (const section of page.sections) {
        if ((section.text.match(/\n\s*\n/g) || []).length < 2) continue;
        const blocks = parseArchiveText(section.text);
        expect(
          blocks.length,
          `${route} section should not collapse to one block`
        ).toBeGreaterThan(1);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });

  it('homepage services point at existing archive service/booking routes', () => {
    for (const service of homepageServices) {
      expect(archivePages).toHaveProperty(service.moreHref);
      expect(archivePages).toHaveProperty(service.href);
    }
  });

  it('no actionable CTA from fixtures keeps raw # when filtered', () => {
    let actionableHash = 0;
    for (const route of Object.keys(archivePages)) {
      const page = archivePages[route as keyof typeof archivePages];
      for (const section of page.sections) {
        for (const button of section.buttons) {
          const resolved = resolveCtaHref(button.label, button.href);
          if (resolved.actionable && resolved.href === '#') actionableHash += 1;
        }
      }
    }
    expect(actionableHash).toBe(0);
  });

  it('decodes percent-encoded archive routes', () => {
    expect(
      getArchivePage(
        '/booking-calendar/' +
          encodeURIComponent('wrzesieńglina-do-wina-piątek-suchy-las')
      )
    ).toBeTruthy();
  });
});
