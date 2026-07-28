import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { primaryNavigation, siteContact } from '@/lib/fixtures/navigation';
import { pracowniaPage } from '@/lib/clone/content/pracownia';
import {
  dlaDzieciPage,
  dlaDoroslychPage,
  dlaFirmPage,
} from '@/lib/clone/content/audience-pages';
import {
  galeriaImages,
  glinaDoWinaPage,
  homepageServices,
} from '@/lib/clone/content/landings';
import {
  glinaBoxPage,
  panienskiePage,
  urodzinyPage,
} from '@/lib/clone/content/glina-box-and-events';

const root = process.cwd();

function localImageExists(src: string) {
  if (!src.startsWith('/images/')) return false;
  return existsSync(path.join(root, 'public', src.replace(/^\//, '')));
}

function assertNoWixHotlink(src: string) {
  expect(src).not.toMatch(/wixstatic\.com|parastorage\.com/i);
}

function qaDir(safeRoute: string) {
  return path.join(root, 'tmp', 'clone-phase1', safeRoute);
}

function assertQaPair(safeRoute: string) {
  const dir = qaDir(safeRoute);
  expect(existsSync(path.join(dir, 'implementation-desktop.png'))).toBe(true);
  expect(existsSync(path.join(dir, 'implementation-mobile.png'))).toBe(true);
  expect(existsSync(path.join(dir, 'original-desktop.png'))).toBe(true);
  expect(existsSync(path.join(dir, 'original-mobile.png'))).toBe(true);
  expect(existsSync(path.join(dir, 'comparison.md'))).toBe(true);
}

function assertPhrasesPresent(blob: string, phrases: string[]) {
  for (const phrase of phrases) {
    expect(blob, `missing phrase: ${phrase}`).toContain(phrase);
  }
}

function flattenPageText(value: unknown): string {
  return JSON.stringify(value).replace(/\\n/g, ' ');
}

function withCanonicalPublicContact(value: string): string {
  const currentPhone = siteContact.phoneDisplay.split(' ');
  const legacyPhone = ['600', '158', '318'];
  let normalized = value.replace(
    /[\w.+-]+@(?:gmail[.]com|ceramikanero[.]com)/gi,
    siteContact.email
  );

  for (const separator of ['', ' ', '-']) {
    normalized = normalized.replaceAll(
      legacyPhone.join(separator),
      currentPhone.join(separator)
    );
  }

  return normalized;
}

type ManifestRoute = {
  originalRoute: string;
  implementedRoute: string;
  status: string;
  verdict?: string;
  originalSectionCount: number;
  implementedSectionCount: number;
  originalOrderedTextBlockCount: number;
  matchedTextBlockCount: number;
  originalContextualImageOccurrences: number;
  matchedContextualImageOccurrences: number;
  originalCtaLinkCount: number;
  matchedCtaLinkCount: number;
  desktopVerification: string;
  mobileVerification: string;
  requiredTextBlocks?: string[];
};

describe('Clone Phase 1 completeness', () => {
  it('exposes original marketing navigation destinations', () => {
    const hrefs = primaryNavigation.map((n) => n.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/pracownia',
        '/kalendarz',
        '/dla-dzieci',
        '/dla-doroslych',
        '/home',
        '/glinadowina',
        '/urodziny',
        '/grupy-i-firmy',
        '/panienskie',
        '/galeria',
        '/kontakt',
        '/blog',
      ])
    );
    expect(hrefs).not.toEqual(expect.arrayContaining(['/warsztaty']));
  });

  it('keeps pracownia section order, phrases and local images', () => {
    expect(pracowniaPage.blocks.length).toBe(10);
    assertPhrasesPresent(flattenPageText(pracowniaPage), [
      'Pracownia Ceramiki Nero to wyjątkowe miejsce',
      'Nie są to zajęcia stałe, można dołączyć w każdym momencie',
      'imprezy integracyjne, tematyczne',
      '2 soboty miesiąca o 15.00',
    ]);
    for (const block of pracowniaPage.blocks) {
      assertNoWixHotlink(block.imageSrc);
      expect(localImageExists(block.imageSrc)).toBe(true);
    }
  });

  it('keeps audience pages with contextual images and required copy', () => {
    expect(dlaDzieciPage.blocks.length).toBe(8);
    expect(dlaDoroslychPage.blocks.length).toBe(4);
    expect(dlaFirmPage.blocks.length).toBe(4);
    assertPhrasesPresent(flattenPageText(dlaDzieciPage), [
      '🔹 Rozwijamy rysunek i wyobraźnię',
      'napisz do nas i poproś o ofertę na: kontakt@ceramikanero.pl',
    ]);
    assertPhrasesPresent(flattenPageText(dlaDoroslychPage), [
      '1 spotkanie = szkliwienie prac',
      'Odkryj swoją kreatywność od samego rana',
    ]);
    for (const page of [dlaDzieciPage, dlaDoroslychPage, dlaFirmPage]) {
      assertNoWixHotlink(page.hero.imageSrc);
      expect(localImageExists(page.hero.imageSrc)).toBe(true);
      for (const block of page.blocks) {
        assertNoWixHotlink(block.imageSrc);
        expect(localImageExists(block.imageSrc)).toBe(true);
      }
    }
  });

  it('keeps workshop landings with archive copy', () => {
    for (const page of [glinaDoWinaPage, urodzinyPage, panienskiePage]) {
      expect(page.blocks.length).toBeGreaterThanOrEqual(3);
      expect(localImageExists(page.hero.imageSrc)).toBe(true);
    }
    assertPhrasesPresent(flattenPageText(urodzinyPage), [
      'pełne kreatywności i zabawy',
      'tel. 532-279-101 Małgosia',
      'Co oferujemy?',
    ]);
    assertPhrasesPresent(flattenPageText(panienskiePage), [
      'PAKIET STANDARD',
      'PAKIET PLUS',
      'PAKIET VIP',
    ]);
    assertPhrasesPresent(flattenPageText(glinaDoWinaPage), ['Degustacja wina']);
  });

  it('expands /home to full archived GLINA BOX long-form page', () => {
    assertPhrasesPresent(flattenPageText(glinaBoxPage), [
      'Stwórz wiosenną podstawkę',
      'BOX CERAMICZNY – Twój pierwszy krok w świat ceramiki',
      'WYJĄTKOWY PREZENT',
      'Chwila oddechu',
      'Kurs krok po kroku',
      'SZKLIWIENIE PRAC W PRACOWNI CERAMIKA NERO',
      '69,00 zł',
      '229,00 zł',
      '137,00 zł',
      'WYSYŁKA PRACY DO SZKLIWIENIA',
      'Zamawiam z kursem krok po kroku',
      'wysyłam pracę do poszkliwienia!',
    ]);
    expect(glinaBoxPage.products.length).toBe(2);
    expect(localImageExists(glinaBoxPage.hero.imageSrc)).toBe(true);
    expect(localImageExists(glinaBoxPage.breath.imageSrc)).toBe(true);
    expect(localImageExists(glinaBoxPage.course.imageSrc)).toBe(true);
    expect(localImageExists(glinaBoxPage.shipping.imageSrc)).toBe(true);
    for (const product of glinaBoxPage.products) {
      expect(localImageExists(product.imageSrc)).toBe(true);
    }
  });

  it('uses original gallery set rather than full dump', () => {
    expect(galeriaImages.length).toBe(33);
    for (const img of galeriaImages) {
      assertNoWixHotlink(img.src);
      expect(localImageExists(img.src)).toBe(true);
    }
    const galeriaPage = readFileSync(
      path.join(root, 'app/galeria/page.tsx'),
      'utf8'
    );
    expect(galeriaPage).toContain('Rękodzieło jako joga umysłu');
    expect(galeriaPage).toContain('Moja pasja ... w obiektywie aparatu.');
  });

  it('homepage catalog services use local images and Polish titles', () => {
    expect(homepageServices.length).toBe(11);
    expect(homepageServices[0]?.title).toContain('GLINA DO WINA');
    for (const service of homepageServices) {
      assertNoWixHotlink(service.image);
      expect(localImageExists(service.image)).toBe(true);
    }
  });

  it('next.config declares original-route permanent redirects', () => {
    const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    expect(config).toContain("source: '/onas'");
    expect(config).toContain("destination: '/pracownia'");
    expect(config).toContain("source: '/dladzieci'");
    expect(config).toContain("source: '/dladoroslych'");
    expect(config).toContain("source: '/dlafirm'");
    expect(config).toMatch(/permanent:\s*true/);
  });

  it('application routes exist for Phase 1 pages without Wix runtime', () => {
    const routes = [
      'app/page.tsx',
      'app/pracownia/page.tsx',
      'app/dla-dzieci/page.tsx',
      'app/dla-doroslych/page.tsx',
      'app/grupy-i-firmy/page.tsx',
      'app/galeria/page.tsx',
      'app/glinadowina/page.tsx',
      'app/urodziny/page.tsx',
      'app/panienskie/page.tsx',
      'app/home/page.tsx',
    ];
    for (const route of routes) {
      expect(existsSync(path.join(root, route))).toBe(true);
      const src = readFileSync(path.join(root, route), 'utf8');
      expect(src).not.toMatch(/wixstatic\.com|static\.wixstatic/i);
      expect(src).not.toMatch(/<iframe/i);
    }
  });

  it('stores desktop/mobile QA evidence for every Phase 1 route', () => {
    for (const safe of [
      'index',
      'pracownia',
      'dla-dzieci',
      'dla-doroslych',
      'grupy-i-firmy',
      'glinadowina',
      'urodziny',
      'panienskie',
      'home',
      'galeria',
    ]) {
      assertQaPair(safe);
    }
  });

  it('phase1.json cannot mark routes complete when accounting fails', () => {
    const manifestPath = path.join(
      root,
      'reference/original-site/implementation/phase1.json'
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      routes: ManifestRoute[];
    };

    const completeStatuses = new Set([
      'Faithful and complete',
      'Complete with documented Wix-only visual differences',
      'complete-with-minor-differences',
      'complete-with-wix-only-visual-differences',
      'faithful-and-complete',
    ]);

    for (const route of manifest.routes) {
      const verdict = route.verdict || route.status;
      if (!completeStatuses.has(verdict)) continue;

      expect(
        route.originalSectionCount,
        `${route.originalRoute} section count`
      ).toBe(route.implementedSectionCount);
      expect(
        route.matchedTextBlockCount,
        `${route.originalRoute} text blocks`
      ).toBe(route.originalOrderedTextBlockCount);
      expect(
        route.matchedContextualImageOccurrences,
        `${route.originalRoute} images`
      ).toBe(route.originalContextualImageOccurrences);
      expect(route.matchedCtaLinkCount, `${route.originalRoute} CTAs`).toBe(
        route.originalCtaLinkCount
      );
      expect(route.desktopVerification).toMatch(/captured|verified/);
      expect(route.mobileVerification).toMatch(/captured|verified/);

      if (route.requiredTextBlocks?.length) {
        const contentBlob = [
          flattenPageText(pracowniaPage),
          flattenPageText(dlaDzieciPage),
          flattenPageText(dlaDoroslychPage),
          flattenPageText(dlaFirmPage),
          flattenPageText(glinaDoWinaPage),
          flattenPageText(urodzinyPage),
          flattenPageText(panienskiePage),
          flattenPageText(glinaBoxPage),
          flattenPageText(homepageServices),
          flattenPageText(galeriaImages),
          readFileSync(path.join(root, 'app/galeria/page.tsx'), 'utf8'),
          readFileSync(path.join(root, 'app/home/page.tsx'), 'utf8'),
          readFileSync(path.join(root, 'app/page.tsx'), 'utf8'),
          readFileSync(path.join(root, 'components/layout/footer.tsx'), 'utf8'),
        ].join('\n');
        for (const phrase of route.requiredTextBlocks) {
          expect(contentBlob).toContain(withCanonicalPublicContact(phrase));
        }
      }
    }
  });
});
