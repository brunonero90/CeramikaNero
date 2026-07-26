import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { siteContact } from '@/lib/fixtures/navigation';
import { getSocialIcon } from '@/lib/media/wix-catalog';

describe('header social icons', () => {
  it('resolves Facebook and Instagram assets with verified URLs', () => {
    const facebook = getSocialIcon('facebook');
    const instagram = getSocialIcon('instagram');
    expect(facebook).not.toBeNull();
    expect(instagram).not.toBeNull();
    expect(siteContact.facebookUrl).toBe(
      'https://www.facebook.com/ceramikanero'
    );
    expect(siteContact.instagramUrl).toBe(
      'https://www.instagram.com/ceramika_nero'
    );
  });

  it('uses equal flex hit-targets and block image rendering in header source', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/layout/header.tsx'),
      'utf8'
    );
    expect(src).toContain('inline-flex h-11 w-11');
    expect(src).toContain('block h-7 w-7 object-contain');
    expect(src).toContain('rel="noopener noreferrer"');
    expect(src).toContain('aria-label="Facebook Ceramika Nero"');
    expect(src).toContain('aria-label="Instagram Ceramika Nero"');
    expect(src).toContain('href="/kalendarz"');
  });

  it('places desktop social icons in the main nav row, not an absolute cluster', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/layout/header.tsx'),
      'utf8'
    );
    expect(src).not.toContain('pointer-events-none absolute');
    expect(src).not.toContain('lg:pr-44');
    const navStart = src.indexOf('aria-label="Nawigacja główna"');
    const navEnd = src.indexOf('ml-auto flex items-center');
    expect(navStart).toBeGreaterThan(-1);
    expect(navEnd).toBeGreaterThan(navStart);
    const navBlock = src.slice(navStart, navEnd);
    expect(navBlock).toContain('aria-label="Facebook Ceramika Nero"');
    expect(navBlock).toContain('aria-label="Instagram Ceramika Nero"');
    expect(navBlock.indexOf('Facebook')).toBeLessThan(
      navBlock.indexOf('Instagram')
    );
    // Mobile menu keeps its own socials; desktop nav must not use absolute cluster.
    expect(src).toContain('aria-label="Menu mobilne"');
  });
});
