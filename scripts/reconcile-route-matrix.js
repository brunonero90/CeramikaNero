'use strict';

/**
 * Reconcile unique public routes vs CMS / blog / operational classifications.
 *   node scripts/reconcile-route-matrix.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const FINAL = require(
  path.join(ROOT, 'reference/original-site/implementation/clone-final.json')
);

const LIVE_PATH = {
  '/': '/',
  '/home': '/home',
  '/onas': '/pracownia',
  '/dladzieci': '/dla-dzieci',
  '/dladoroslych': '/dla-doroslych',
  '/dlafirm': '/grupy-i-firmy',
  '/copy-of-panieński-opis': '/copy-of-panienski-opis',
  '/kopia-panieński-plus-opis': '/kopia-panienski-plus-opis',
};

const PRIORITY = new Set([
  '/',
  '/urodziny',
  '/panienskie',
  '/home',
  '/kontakt',
  '/glinadowina',
  '/dla-dzieci',
  '/dla-doroslych',
  '/grupy-i-firmy',
  '/pracownia',
  '/dladzieci',
  '/dladoroslych',
  '/dlafirm',
  '/onas',
]);

function groupFor(route, classification) {
  if (
    route.startsWith('/post/') ||
    route === '/blog' ||
    route.includes('/blog/')
  )
    return 'blog';
  if (route === '/kalendarz') return 'operational';
  if (
    route.startsWith('/booking-calendar') ||
    route.startsWith('/service-page')
  )
    return 'booking-service';
  if (
    route.startsWith('/product-page') ||
    route === '/sklep' ||
    route === '/cart'
  )
    return 'commerce';
  if (classification === 'Permanent redirect') return 'redirect-alias';
  if (PRIORITY.has(route) || PRIORITY.has(LIVE_PATH[route]))
    return 'priority-marketing';
  return 'archive-content';
}

function evidence(route) {
  const rel = route === '/' ? 'index' : route.replace(/^\//, '');
  const base = path.join(ROOT, 'reference/original-site/pages', rel);
  return {
    contentMd: fs.existsSync(path.join(base, 'content.md')),
    pageSpec: fs.existsSync(path.join(base, 'page-spec.json')),
    renderedHtml: fs.existsSync(path.join(base, 'rendered.html')),
  };
}

const rows = [];
const seenLive = new Map();

for (const r of FINAL.routes) {
  const original = r.originalRoute;
  const live =
    r.redirectDestination ||
    r.canonicalNewRoute ||
    LIVE_PATH[original] ||
    original.replace(/ń/g, 'n');
  const classification = r.finalClassification;
  const isBlog =
    original.startsWith('/post/') ||
    original === '/blog' ||
    original.includes('/blog/');
  const isRedirect = classification === 'Permanent redirect';
  const isImplemented = classification === 'Implemented directly';
  const ev = evidence(original);

  const row = {
    route: live,
    originalRoute: original,
    routeGroup: groupFor(original, classification),
    originalEvidenceAvailable: ev.contentMd && ev.pageSpec,
    currentRendererTemplate: isBlog
      ? 'blog'
      : isRedirect
        ? `redirect→${live}`
        : PRIORITY.has(live) || PRIORITY.has(original)
          ? 'marketing-split / homepage / calendar'
          : 'archive / resolved-archive',
    proposedDatabaseSource: isBlog
      ? 'blog_posts (deferred)'
      : live === '/kalendarz'
        ? 'workshop_sessions (operational)'
        : 'content_pages.clone-page-v1',
    staticFallback: true,
    includedInCmsImport: !isBlog && isImplemented && live !== '/kalendarz',
    includedInBlogMigration: isBlog,
    operationalNonCms: live === '/kalendarz',
    fidelityStatus: 'not-yet-faithful',
    remainingDifferences:
      original === '/faq'
        ? 'Blocked — Wix FAQ template pollution only'
        : 'Pending priority chrome+body visual pass',
  };

  const key = live;
  if (!seenLive.has(key)) seenLive.set(key, row);
  else {
    const prev = seenLive.get(key);
    prev.originalRoute = `${prev.originalRoute} | ${original}`;
    if (isRedirect) prev.routeGroup = prev.routeGroup || 'redirect-alias';
  }
  rows.push(row);
}

const unique = [...seenLive.values()].sort((a, b) =>
  a.route.localeCompare(b.route)
);

const summary = {
  generatedAt: new Date().toISOString(),
  cloneFinalRouteRows: FINAL.routes.length,
  uniqueLiveRoutes: unique.length,
  byGroup: unique.reduce((acc, r) => {
    acc[r.routeGroup] = (acc[r.routeGroup] || 0) + 1;
    return acc;
  }, {}),
  cmsImportCandidates: unique.filter((r) => r.includedInCmsImport).length,
  blogDeferred: unique.filter((r) => r.includedInBlogMigration).length,
  operational: unique.filter((r) => r.operationalNonCms).length,
  overlapExplanation: [
    '77 = Implemented directly rows in clone-final.json (includes nested booking/service/product/blog posts).',
    '57 ≈ proposed content_pages for non-blog implemented content routes (preview under tmp/cms-import/revised).',
    '24 = blog index/category/post routes deferred to blog_posts.',
    '1 = /kalendarz operational.',
    'Redirect aliases (/onas→/pracownia, /dladzieci→/dla-dzieci, …) are extra clone-final rows that collapse onto unique live routes — they must not be double-counted.',
    '82 appeared when summing 77+redirects/CMS counts without deduplicating live paths.',
  ],
};

const outDir = path.join(ROOT, 'tmp/fidelity-audit');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'route-matrix.json'),
  JSON.stringify({ summary, uniqueLiveRoutes: unique, allRows: rows }, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'route-matrix.csv'),
  [
    'route,originalRoute,routeGroup,originalEvidenceAvailable,currentRendererTemplate,proposedDatabaseSource,staticFallback,includedInCmsImport,includedInBlogMigration,operationalNonCms,fidelityStatus,remainingDifferences',
    ...unique.map((r) =>
      [
        r.route,
        JSON.stringify(r.originalRoute),
        r.routeGroup,
        r.originalEvidenceAvailable,
        JSON.stringify(r.currentRendererTemplate),
        JSON.stringify(r.proposedDatabaseSource),
        r.staticFallback,
        r.includedInCmsImport,
        r.includedInBlogMigration,
        r.operationalNonCms,
        r.fidelityStatus,
        JSON.stringify(r.remainingDifferences),
      ].join(',')
    ),
  ].join('\n')
);

console.log(JSON.stringify(summary, null, 2));
console.log('Wrote tmp/fidelity-audit/route-matrix.json');
