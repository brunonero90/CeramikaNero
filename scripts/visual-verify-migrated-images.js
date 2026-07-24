/**
 * Visual verification of migrated-image routes via Playwright.
 * Starts against an already-running local Next server (BASE_URL).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tmp', 'wix-crawl');
const SHOTS = path.join(OUT, 'screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:3002';

const ROUTES = [
  '/',
  '/galeria',
  '/pracownia',
  '/dla-dzieci',
  '/dla-doroslych',
  '/grupy-i-firmy',
  '/warsztaty',
  '/blog',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

fs.mkdirSync(SHOTS, { recursive: true });

async function inspectRoute(page, route, viewport) {
  const url = `${BASE}${route}`;
  const response = await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  // Force lazy-loaded Next/Image nodes to load by scrolling the page.
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let total = 0;
      const step = Math.max(300, Math.floor(window.innerHeight * 0.8));
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve(undefined);
        }
      }, 50);
    });
  });
  await page.waitForTimeout(1200);
  // Wait until migrated images report natural dimensions where present
  await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('img')];
        const migrated = imgs.filter((img) => {
          const raw = img.currentSrc || img.src || '';
          return (
            raw.includes('wix-migrated') ||
            raw.includes('images%2Fwix-migrated')
          );
        });
        if (migrated.length === 0) return true;
        const loaded = migrated.filter(
          (img) => img.complete && img.naturalWidth > 0
        );
        return loaded.length / migrated.length >= 0.85;
      },
      { timeout: 20000 }
    )
    .catch(() => {});

  const imgs = await page.evaluate(() => {
    return [...document.querySelectorAll('img')].map((img) => {
      const rect = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      const rawSrc = img.currentSrc || img.src || '';
      let decodedSrc = rawSrc;
      try {
        const u = new URL(rawSrc, location.origin);
        if (u.pathname.includes('/_next/image')) {
          decodedSrc = u.searchParams.get('url') || rawSrc;
        }
      } catch {
        // keep raw
      }
      return {
        src: rawSrc,
        resolvedSrc: decodeURIComponent(decodedSrc),
        alt: img.alt || '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: Math.round(rect.width),
        displayHeight: Math.round(rect.height),
        complete: img.complete,
        visible:
          rect.width > 0 &&
          rect.height > 0 &&
          cs.visibility !== 'hidden' &&
          cs.display !== 'none' &&
          cs.opacity !== '0',
        objectFit: cs.objectFit,
      };
    });
  });

  const bgUrls = await page.evaluate(() => {
    const urls = [];
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage || '';
      const m = [...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
      for (const x of m) urls.push(x[1]);
    }
    return [...new Set(urls)];
  });

  const isMigrated = (src) =>
    /\/images\/wix-migrated\//i.test(src) || /images%2Fwix-migrated/i.test(src);
  const localImgs = imgs.filter(
    (i) => isMigrated(i.src) || isMigrated(i.resolvedSrc)
  );
  const hotlinked = imgs.filter((i) =>
    /wixstatic\.com|wix\.com\/media/i.test(i.src + i.resolvedSrc)
  );
  const hotlinkedBg = bgUrls.filter((u) =>
    /wixstatic\.com|wix\.com\/media/i.test(u)
  );
  const broken = localImgs.filter(
    (i) => i.complete && (i.naturalWidth === 0 || i.naturalHeight === 0)
  );
  const stillLoading = localImgs.filter((i) => !i.complete);
  // Large galleries may leave a few below-fold nodes incomplete even after scroll;
  // treat as soft warning unless a high share never finished.
  const loadRatio =
    localImgs.length === 0
      ? 1
      : (localImgs.length - stillLoading.length) / localImgs.length;
  const distorted = localImgs.filter((i) => {
    if (!i.visible || !i.naturalWidth || !i.displayWidth) return false;
    const nat = i.naturalWidth / i.naturalHeight;
    const disp = i.displayWidth / Math.max(i.displayHeight, 1);
    const ratioDelta = Math.abs(nat - disp) / nat;
    return i.objectFit === 'fill' && ratioDelta > 0.35;
  });

  const shotName = `${viewport.name}${route.replace(/\W+/g, '_') || '_home'}.png`;
  const shotPath = path.join(SHOTS, shotName);
  await page.screenshot({ path: shotPath, fullPage: true });

  const migratedSrcs = [
    ...new Set(
      localImgs.map((i) => {
        const s = isMigrated(i.resolvedSrc) ? i.resolvedSrc : i.src;
        try {
          return new URL(s, BASE).pathname;
        } catch {
          return s.split('?')[0];
        }
      })
    ),
  ];

  return {
    route,
    viewport: viewport.name,
    httpStatus: response?.status() ?? null,
    finalUrl: page.url(),
    imageCount: imgs.length,
    migratedImageCount: localImgs.length,
    migratedSrcs,
    hotlinkedWixImages: hotlinked.map((i) => i.src),
    hotlinkedWixBackgrounds: hotlinkedBg,
    brokenMigratedImages: broken,
    stillLoadingCount: stillLoading.length,
    loadRatio,
    severeDistortion: distorted,
    alts: localImgs.map((i) => ({
      src: (isMigrated(i.resolvedSrc) ? i.resolvedSrc : i.src).split('/').pop(),
      alt: i.alt,
      decorativeEmptyAlt: i.alt === '',
    })),
    screenshot: path.relative(ROOT, shotPath).replace(/\\/g, '/'),
    ok:
      (response?.ok() ?? false) &&
      broken.length === 0 &&
      loadRatio >= 0.7 &&
      hotlinked.length === 0 &&
      hotlinkedBg.length === 0,
  };
}

(async () => {
  // Health check
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server unhealthy: ${res.status}`);
    }
  } catch (err) {
    console.error(`Cannot reach ${BASE}: ${err}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    for (const route of ROUTES) {
      try {
        results.push(await inspectRoute(page, route, viewport));
      } catch (err) {
        results.push({
          route,
          viewport: viewport.name,
          ok: false,
          error: String(err),
        });
      }
    }
    await context.close();
  }

  await browser.close();

  const allMigratedSrcs = [
    ...new Set(
      results
        .flatMap((r) => r.migratedSrcs || [])
        .map((s) => s.replace(BASE, ''))
    ),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    method: 'playwright-chromium-live-render',
    routeResults: results,
    summary: {
      checks: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      uniqueMigratedSrcsObserved: allMigratedSrcs.length,
      anyHotlinking: results.some(
        (r) =>
          (r.hotlinkedWixImages || []).length > 0 ||
          (r.hotlinkedWixBackgrounds || []).length > 0
      ),
      anyBrokenMigrated: results.some(
        (r) => (r.brokenMigratedImages || []).length > 0
      ),
    },
  };

  fs.writeFileSync(
    path.join(OUT, 'visual-verification.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report.summary, null, 2));
})();
