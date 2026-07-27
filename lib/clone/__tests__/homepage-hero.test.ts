import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('homepage hero sizing', () => {
  it('uses the Atelier split hero and dedicated studio photograph', () => {
    const src = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
    const heroStart = src.indexOf('aria-label="Baner główny"');
    const heroEnd = src.indexOf('<Section>', heroStart);
    expect(heroStart).toBeGreaterThan(-1);
    expect(heroEnd).toBeGreaterThan(heroStart);
    const hero = src.slice(heroStart, heroEnd);
    expect(src).toContain('/images/generated/atelier-hero.png');
    expect(hero).toContain('Tu glina');
    expect(hero).toContain('lg:min-h-[620px]');
    expect(hero).toContain('object-cover object-[54%_center]');
    expect(hero).toContain('Zarezerwuj warsztat');
    expect(hero).toContain('Poznaj pracownię');
    expect(hero).not.toContain('bg-[#9e6d5b]');
    expect(hero).not.toContain('object-contain');
  });
});
