import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('homepage hero sizing', () => {
  it('uses contain + clay fill and bounded responsive heights', () => {
    const src = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
    const heroStart = src.indexOf('aria-label="Baner główny"');
    const heroEnd = src.indexOf('<Section>', heroStart);
    expect(heroStart).toBeGreaterThan(-1);
    expect(heroEnd).toBeGreaterThan(heroStart);
    const hero = src.slice(heroStart, heroEnd);
    expect(hero).toContain('bg-[#9e6d5b]');
    expect(hero).toContain('object-contain object-center');
    expect(hero).toContain('lg:h-[clamp(500px,68svh,640px)]');
    expect(hero).toContain('sm:h-[clamp(380px,55svh,520px)]');
    expect(hero).toContain('h-[clamp(280px,48svh,420px)]');
    expect(hero).not.toMatch(/min-h-\[7[28]vh\]/);
    expect(hero).not.toContain('object-cover');
  });
});
