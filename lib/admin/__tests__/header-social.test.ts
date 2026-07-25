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
});
