import { describe, expect, it } from 'vitest';
import {
  urodzinyPage,
  panienskiePage,
} from '@/lib/clone/content/glina-box-and-events';
import { knownHeadingsForSection } from '@/lib/clone/page-spec-headings.node';

/**
 * Route-specific expected structures from archived page-spec evidence.
 * These fail when copy/CTA/heading structure drifts from the original.
 */
describe('urodziny expected structure', () => {
  it('matches page-spec heading sequence', () => {
    const headings = knownHeadingsForSection('/urodziny', 1);
    expect(headings).toEqual(
      expect.arrayContaining([
        'Urodziny\npełne kreatywności i zabawy',
        'Co oferujemy?',
        'Urodziny z ceramiką\ndla dzieci',
        'Urodziny ozdabianie kubka',
        'Urodziny dla dorosłych',
        'Urodziny z malowaniem',
      ])
    );
  });

  it('keeps archived intro paragraph count and CTAs', () => {
    expect(urodzinyPage.hero.intro).toHaveLength(5);
    expect(urodzinyPage.blocks.map((b) => b.ctaHref)).toEqual([
      '/kopia-panienski-plus-opis',
      '/kopia-urodziny-ceramika',
      '/glinadowina',
      'mailto:kontakt@ceramikanero.pl?subject=Urodziny%20z%20malowaniem%20',
    ]);
    expect(urodzinyPage.blocks.map((b) => b.ctaLabel)).toEqual([
      'Więcej szczegółów...',
      'Więcej szczegółów...',
      'Więcej szczegółów...',
      'Napisz do nas',
    ]);
  });

  it('preserves offer-intro labeled paragraphs', () => {
    expect(urodzinyPage.offerIntro.heading).toBe('Co oferujemy?');
    expect(urodzinyPage.offerIntro.paragraphs[1]).toMatch(/^Tworzenie:/);
    expect(urodzinyPage.offerIntro.paragraphs[2]).toMatch(/^Dekorowanie:/);
    expect(urodzinyPage.offerIntro.paragraphs[3]).toMatch(/^Poczęstunek:/);
  });
});

describe('panienskie expected structure', () => {
  it('keeps three framed centered packages', () => {
    expect(panienskiePage.blocks).toHaveLength(3);
    for (const block of panienskiePage.blocks) {
      expect(block.framed).toBe(true);
      expect(block.textAlign).toBe('center');
      expect(block.title).toContain('\n');
    }
  });

  it('matches package CTA destinations from archive buttons', () => {
    expect(panienskiePage.blocks.map((b) => b.ctaHref)).toEqual([
      '/webinar-registration',
      '/webinar-registration-1',
      '/copy-of-panienski-opis',
    ]);
  });
});
