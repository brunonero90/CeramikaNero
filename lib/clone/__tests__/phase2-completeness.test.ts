import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { archiveBlogPosts } from '@/lib/clone/content/phase2/blog-posts';
import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import { getOrderedBlogPosts, getBlogPost } from '@/components/clone/blog';
import { listArchiveRoutes } from '@/lib/clone/archive';

const root = process.cwd();

function localImageExists(src: string) {
  if (!src.startsWith('/images/')) return false;
  return existsSync(path.join(root, 'public', src.replace(/^\//, '')));
}

describe('Clone Phase 2 completeness', () => {
  it('includes all archived blog posts', () => {
    expect(archiveBlogPosts.posts.length).toBe(20);
    expect(getOrderedBlogPosts().length).toBe(20);
    expect(getBlogPost('glina-do-wina')?.title).toContain('Glina do wina');
  });

  it('exposes blog and post application routes', () => {
    for (const file of [
      'app/blog/page.tsx',
      'app/blog/categories/[category]/page.tsx',
      'app/post/[slug]/page.tsx',
    ]) {
      expect(existsSync(path.join(root, file))).toBe(true);
      const src = readFileSync(path.join(root, file), 'utf8');
      expect(src).not.toMatch(/wixstatic\.com|static\.wixstatic/i);
      expect(src).not.toMatch(/<iframe/i);
    }
  });

  it('archives shop, legal, webinar and service pages without Wix hotlinks', () => {
    const routes = listArchiveRoutes();
    expect(routes).toEqual(
      expect.arrayContaining([
        '/sklep',
        '/cart',
        '/vouchery',
        '/gift-card',
        '/regulamin',
        '/faq',
        '/dostawy-i-zwroty',
        '/terms-conditions',
        '/webinar-registration',
        '/services',
      ])
    );
    expect(routes.filter((r) => r.startsWith('/product-page/')).length).toBe(2);
    expect(
      routes.filter((r) => r.startsWith('/service-page/')).length
    ).toBeGreaterThanOrEqual(10);
    expect(
      routes.filter((r) => r.startsWith('/booking-calendar/')).length
    ).toBeGreaterThanOrEqual(8);
    expect(
      routes.filter((r) => r.startsWith('/webinar-registration')).length
    ).toBe(5);

    for (const route of routes) {
      const page = (archivePages as Record<string, { title: string }>)[route];
      expect(page?.title).toBeTruthy();
      const fileGuess = path.join(
        root,
        'app',
        route === '/courses' ? 'courses/page.tsx' : `${route.slice(1)}/page.tsx`
      );
      // dynamic routes covered separately
      if (
        route.startsWith('/product-page/') ||
        route.startsWith('/service-page/') ||
        route.startsWith('/booking-calendar/') ||
        (route.startsWith('/courses/') && route !== '/courses') ||
        route.startsWith('/szczeg-y-wydarzenia-i-rejestracja/')
      ) {
        continue;
      }
      expect(existsSync(fileGuess)).toBe(true);
      const src = readFileSync(fileGuess, 'utf8');
      expect(src).not.toMatch(/stripe\.com|resend\.com/i);
      expect(src).not.toMatch(/wixstatic\.com/i);
    }
  });

  it('keeps product images local when referenced', () => {
    for (const post of archiveBlogPosts.posts) {
      for (const img of post.images) {
        if (!img.src) continue;
        expect(img.src).not.toMatch(/wixstatic\.com/i);
        expect(localImageExists(img.src)).toBe(true);
      }
    }
  });

  it('cart and product pages document non-live commerce', () => {
    const cart = readFileSync(
      path.join(root, 'components/clone/cart-page-client.tsx'),
      'utf8'
    );
    expect(cart).toMatch(/bez płatności/i);
    const add = readFileSync(
      path.join(root, 'components/clone/add-to-cart-button.tsx'),
      'utf8'
    );
    expect(add).toMatch(/lokalne/i);
    expect(add).not.toMatch(/stripe|checkout\.session/i);
  });

  it('phase2.json exists and does not mark incomplete routes as faithful', () => {
    const manifestPath = path.join(
      root,
      'reference/original-site/implementation/phase2.json'
    );
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      routes: {
        originalRoute: string;
        verdict: string;
        originalSectionCount: number;
        implementedSectionCount: number;
        matchedTextBlockCount: number;
        originalOrderedTextBlockCount: number;
        matchedContextualImageOccurrences: number;
        originalContextualImageOccurrences: number;
        desktopVerification: string;
        mobileVerification: string;
      }[];
    };
    const complete = new Set([
      'Faithful and complete',
      'Complete with documented Wix-only visual differences',
    ]);
    for (const route of manifest.routes) {
      if (!complete.has(route.verdict)) continue;
      expect(route.originalSectionCount).toBe(route.implementedSectionCount);
      expect(route.matchedTextBlockCount).toBe(
        route.originalOrderedTextBlockCount
      );
      expect(route.matchedContextualImageOccurrences).toBe(
        route.originalContextualImageOccurrences
      );
      expect(route.desktopVerification).toMatch(
        /captured|verified|representative/
      );
      expect(route.mobileVerification).toMatch(
        /captured|verified|representative/
      );
    }
  });
});
