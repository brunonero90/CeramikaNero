import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { primaryNavigation } from '@/lib/fixtures/navigation';
import { pracowniaPage } from '@/lib/clone/content/pracownia';
import {
  dlaDzieciPage,
  dlaDoroslychPage,
  dlaFirmPage,
} from '@/lib/clone/content/audience-pages';
import {
  galeriaImages,
  glinaBoxPage,
  glinaDoWinaPage,
  homepageServices,
  panienskiePage,
  urodzinyPage,
} from '@/lib/clone/content/landings';

const root = process.cwd();

function localImageExists(src: string) {
  if (!src.startsWith('/images/')) return false;
  return existsSync(path.join(root, 'public', src.replace(/^\//, '')));
}

function assertNoWixHotlink(src: string) {
  expect(src).not.toMatch(/wixstatic\.com|parastorage\.com/i);
}

describe('Clone Phase 1 completeness', () => {
  it('exposes original marketing navigation destinations', () => {
    const hrefs = primaryNavigation.map((n) => n.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/pracownia',
        '/',
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

  it('keeps pracownia section order and image locals', () => {
    expect(pracowniaPage.blocks.length).toBeGreaterThanOrEqual(8);
    expect(pracowniaPage.hero.intro?.[0]).toContain(
      'Pracownia Ceramiki Nero to wyjątkowe miejsce'
    );
    for (const block of pracowniaPage.blocks) {
      assertNoWixHotlink(block.imageSrc);
      expect(localImageExists(block.imageSrc)).toBe(true);
    }
  });

  it('keeps audience pages with contextual images', () => {
    expect(dlaDzieciPage.blocks.length).toBe(8);
    expect(dlaDoroslychPage.blocks.length).toBe(4);
    expect(dlaFirmPage.blocks.length).toBe(4);
    for (const page of [dlaDzieciPage, dlaDoroslychPage, dlaFirmPage]) {
      assertNoWixHotlink(page.hero.imageSrc);
      expect(localImageExists(page.hero.imageSrc)).toBe(true);
      for (const block of page.blocks) {
        assertNoWixHotlink(block.imageSrc);
        expect(localImageExists(block.imageSrc)).toBe(true);
      }
    }
  });

  it('keeps workshop landings and GLINA BOX assets local', () => {
    for (const page of [glinaDoWinaPage, urodzinyPage, panienskiePage]) {
      expect(page.blocks.length).toBeGreaterThanOrEqual(3);
      expect(localImageExists(page.hero.imageSrc)).toBe(true);
    }
    expect(glinaBoxPage.gallery.length).toBeGreaterThanOrEqual(5);
    for (const img of glinaBoxPage.gallery) {
      expect(localImageExists(img.src)).toBe(true);
    }
  });

  it('uses original gallery set rather than full dump', () => {
    expect(galeriaImages.length).toBe(33);
    for (const img of galeriaImages) {
      assertNoWixHotlink(img.src);
      expect(localImageExists(img.src)).toBe(true);
    }
  });

  it('homepage catalog services use local images and Polish titles', () => {
    expect(homepageServices.length).toBe(11);
    expect(homepageServices[0]?.title).toContain('GLINA DO WINA');
    for (const service of homepageServices) {
      assertNoWixHotlink(service.image);
      expect(localImageExists(service.image)).toBe(true);
    }
  });

  it('next.config declares original-route redirects', () => {
    const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    expect(config).toContain("source: '/onas'");
    expect(config).toContain("destination: '/pracownia'");
    expect(config).toContain("source: '/dladzieci'");
    expect(config).toContain("source: '/dladoroslych'");
    expect(config).toContain("source: '/dlafirm'");
  });

  it('application routes exist for Phase 1 pages', () => {
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
});
