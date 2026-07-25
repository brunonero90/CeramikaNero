import { describe, expect, it } from 'vitest';
import { parseArchiveText } from '@/lib/clone/parse-archive-text';
import { knownHeadingsForSection } from '@/lib/clone/page-spec-headings';
import {
  urodzinyPage,
  panienskiePage,
} from '@/lib/clone/content/glina-box-and-events';

describe('visual fidelity text structure', () => {
  it('never promotes random short lines to headings', () => {
    const sample = 'Małgorzata Nero\n\nPracownia ceramiki Nero\n\nSuchy Las';
    const blocks = parseArchiveText(sample);
    expect(blocks.every((b) => b.type !== 'heading')).toBe(true);
  });

  it('keeps panieńskie package titles multi-line as in page-spec', () => {
    expect(panienskiePage.blocks[0]!.title).toBe(
      'Panieński\nPAKIET STANDARD\nGlina do wina'
    );
    expect(
      panienskiePage.blocks[2]!.title.split('\n').length
    ).toBeGreaterThanOrEqual(4);
  });

  it('urodziny hero and intro match archived page-spec copy', () => {
    expect(urodzinyPage.hero.title).toBe(
      'Urodziny\npełne kreatywności i zabawy'
    );
    expect(urodzinyPage.hero.intro.length).toBeGreaterThanOrEqual(5);
    expect(urodzinyPage.blocks[0]!.title).toBe(
      'Urodziny z ceramiką\ndla dzieci'
    );
    expect(urodzinyPage.blocks[1]!.ctaHref).toBe('/kopia-urodziny-ceramika');
    expect(urodzinyPage.blocks[3]!.ctaHref).toMatch(/^mailto:/);
  });

  it('kontakt page-spec provides Kontakt heading evidence', () => {
    const headings = knownHeadingsForSection('/kontakt', 1);
    expect(headings.some((h) => /kontakt/i.test(h))).toBe(true);
  });
});
