import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const root = process.cwd();
const finalPath = path.join(
  root,
  'reference/original-site/implementation/clone-final.json'
);
const invPath = path.join(root, 'reference/original-site/page-inventory.json');

describe('Clone closure', () => {
  it('clone-final.json accounts for exactly 99 discovered URLs once', () => {
    expect(existsSync(finalPath)).toBe(true);
    const final = JSON.parse(readFileSync(finalPath, 'utf8'));
    const inv = JSON.parse(readFileSync(invPath, 'utf8'));
    expect(final.routes.length).toBe(99);
    expect(inv.pages.length).toBe(99);
    expect(final.totalsSumCheck).toBe(99);

    const seen = new Set<string>();
    for (const r of final.routes) {
      expect(seen.has(r.originalRoute)).toBe(false);
      seen.add(r.originalRoute);
    }
    for (const p of inv.pages) {
      expect(seen.has(p.originalRoute)).toBe(true);
    }

    const sum =
      final.totals.implementedDirectly +
      final.totals.permanentRedirects +
      final.totals.formallyExcluded +
      final.totals.retained404 +
      final.totals.blocked +
      final.totals.ambiguous;
    expect(sum).toBe(99);
  });

  it('resolves legacy-copy routes as unique implementations', () => {
    const final = JSON.parse(readFileSync(finalPath, 'utf8'));
    for (const route of [
      '/copy-of-panieński-opis',
      '/kopia-panieński-plus-opis',
      '/kopia-urodziny-ceramika',
    ]) {
      const row = final.routes.find(
        (r: { originalRoute: string }) => r.originalRoute === route
      );
      expect(row.finalClassification).toBe('Implemented directly');
      expect(
        existsSync(path.join(root, 'app', route.slice(1), 'page.tsx'))
      ).toBe(true);
    }
  });

  it('classifies profile surfaces without recreating Wix members', () => {
    const final = JSON.parse(readFileSync(finalPath, 'utf8'));
    const profile = final.routes.find(
      (r: { originalRoute: string }) =>
        r.originalRoute === '/profile/gosianowicka/profile'
    );
    expect(profile.finalClassification).toBe('Permanent redirect');
    expect(profile.redirectDestination).toBe('/blog');

    const events = final.routes.find(
      (r: { originalRoute: string }) =>
        r.originalRoute === '/profile/gosianowicka/events'
    );
    expect(events.finalClassification).toBe('Permanent redirect');

    for (const route of [
      '/profile/gosianowicka/forum-posts',
      '/profile/gosianowicka/forum-comments',
    ]) {
      const row = final.routes.find(
        (r: { originalRoute: string }) => r.originalRoute === route
      );
      expect(row.finalClassification).toBe(
        'Formally excluded system/template route'
      );
      expect(row.genuineCeramikaNeroContent).toBe(false);
    }

    const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    expect(config).toContain('/profile/gosianowicka/profile');
    expect(config).toContain("destination: '/blog'");
  });

  it('does not mark overall complete while genuine routes remain ambiguous', () => {
    const final = JSON.parse(readFileSync(finalPath, 'utf8'));
    expect(final.totals.ambiguous).toBe(0);
    if (
      final.overallVerdict ===
      'Clone complete with documented Wix-only differences'
    ) {
      const unresolved = final.routes.filter(
        (r: {
          genuineCeramikaNeroContent: boolean;
          finalClassification: string;
        }) =>
          r.genuineCeramikaNeroContent &&
          !['Implemented directly', 'Permanent redirect'].includes(
            r.finalClassification
          )
      );
      expect(unresolved).toEqual([]);
    }
  });

  it('keeps Phase 1 redirects and VIP deep-link', () => {
    const config = readFileSync(path.join(root, 'next.config.ts'), 'utf8');
    expect(config).toContain("source: '/onas'");
    const panienskie = readFileSync(
      path.join(root, 'lib/clone/content/glina-box-and-events.ts'),
      'utf8'
    );
    expect(panienskie).toContain('/copy-of-panieński-opis');
  });

  it('production clone sources do not embed Wix hotlinks or iframes', () => {
    const files = [
      'app/copy-of-panieński-opis/page.tsx',
      'app/kopia-panieński-plus-opis/page.tsx',
      'app/kopia-urodziny-ceramika/page.tsx',
      'components/clone/archive-page.tsx',
      'lib/clone/content/phase2/archive-pages.ts',
    ];
    for (const file of files) {
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src).not.toMatch(/wixstatic\.com|static\.wixstatic/i);
      expect(src).not.toMatch(/<iframe/i);
      expect(src).not.toMatch(/graph\.facebook\.com/i);
    }
  });
});
