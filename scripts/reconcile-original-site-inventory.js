'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/original-site-paths');

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const inventoryPath = path.join(ROOT, 'page-inventory.json');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

const updates = [];
for (const page of inventory.pages) {
  if (page.captureStatus === 'excluded') continue;
  const files = [
    page.rawHtmlPath,
    page.renderedHtmlPath,
    page.pageSpecPath,
    page.extractedContentPath,
    page.desktopScreenshotPath,
    page.mobileScreenshotPath,
  ];
  const complete = files.every(
    (f) => f && fs.existsSync(f) && fs.statSync(f).size > 50
  );
  if (!complete) {
    updates.push({
      route: page.originalRoute,
      action: 'incomplete',
      status: page.captureStatus,
    });
    continue;
  }

  const rendered = fs.readFileSync(page.renderedHtmlPath, 'utf8');
  const text = stripHtml(rendered);
  const isChallenge =
    /just a moment|cf-browser-verification|attention required/i.test(rendered);
  const looks404 =
    page.originalRoute === '/warsztaty' ||
    (/nie znaleziono|page not found|404/i.test(text.slice(0, 400)) &&
      text.length < 500);

  if (isChallenge) {
    page.captureStatus = 'failed-challenge';
    updates.push({ route: page.originalRoute, action: 'challenge' });
  } else if (page.originalRoute === '/warsztaty') {
    page.captureStatus = 'excluded';
    page.classification = 'excluded-not-on-original-site';
    page.exclusionReason =
      'Original site returns HTTP 404 for /warsztaty. Route exists on the new Next.js site only; artifacts kept under pages/warsztaty for evidence.';
    page.rawHtmlPath = page.rawHtmlPath; // keep paths for evidence
    updates.push({
      route: page.originalRoute,
      action: 'reclassified-excluded-404',
      textLen: text.length,
      sample: text.slice(0, 160),
    });
  } else if (text.length < 80) {
    page.captureStatus = 'partial-shell';
    updates.push({
      route: page.originalRoute,
      action: 'shell',
      textLen: text.length,
    });
  } else if (page.captureStatus !== 'captured') {
    page.captureStatus = 'captured';
    updates.push({
      route: page.originalRoute,
      action: 'status-fixed-to-captured',
      textLen: text.length,
    });
  }
}

fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));

inventory.totals.included = inventory.pages.filter(
  (p) => p.captureStatus !== 'excluded'
).length;
inventory.totals.excluded = inventory.pages.filter(
  (p) => p.captureStatus === 'excluded'
).length;
fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2));

const included = inventory.pages.filter((p) => p.captureStatus !== 'excluded');
const excluded = inventory.pages.filter((p) => p.captureStatus === 'excluded');

const readmeLines = [];
readmeLines.push('# Original Ceramika Nero site — reference archive');
readmeLines.push('');
readmeLines.push(
  'This directory is an **authoritative visual/content reference** for rebuilding each page faithfully in the Next.js application.'
);
readmeLines.push('');
readmeLines.push(
  '**Do not** serve `raw.html` / `rendered.html` in production.'
);
readmeLines.push(
  '**Do not** load Wix runtime, trackers, or hotlinked `wixstatic` assets from the finished app.'
);
readmeLines.push('');
readmeLines.push('## Source');
readmeLines.push('');
readmeLines.push('- Original URL: https://www.ceramikanero.com/');
readmeLines.push(`- Capture date: ${inventory.generatedAt}`);
readmeLines.push(`- Genuine included pages: ${included.length}`);
readmeLines.push(`- Excluded routes: ${excluded.length}`);
readmeLines.push('');
readmeLines.push('## How capture was created');
readmeLines.push('');
readmeLines.push(
  '1. Rediscovered URLs from robots.txt, sitemaps, seeds, prior crawl, and Playwright link crawl (nav/footer/content + load-more).'
);
readmeLines.push(
  '2. Classified genuine Ceramika pages vs Wix template/system routes.'
);
readmeLines.push(
  '3. Saved raw HTTP HTML and Playwright-rendered DOM after scroll/lazy-load/accordion/load-more.'
);
readmeLines.push('4. Extracted `page-spec.json` + verbatim `content.md`.');
readmeLines.push('5. Full-page desktop (1440) and mobile (390) screenshots.');
readmeLines.push(
  '6. Mapped every visible image occurrence to local `/images/wix-migrated/*` when possible.'
);
readmeLines.push(
  '7. Extracted computed design tokens into `design-system.json`.'
);
readmeLines.push(
  '8. Compared routes to the current Next.js app in `clone-gap-analysis.*`.'
);
readmeLines.push('');
readmeLines.push('## Directory structure');
readmeLines.push('');
readmeLines.push('```');
readmeLines.push('reference/original-site/');
readmeLines.push('  page-inventory.json');
readmeLines.push('  image-placement.json');
readmeLines.push('  design-system.json');
readmeLines.push('  design-notes.md');
readmeLines.push('  clone-gap-analysis.json');
readmeLines.push('  clone-gap-analysis.md');
readmeLines.push('  asset-manifest.json');
readmeLines.push('  README.md');
readmeLines.push('  pages/<safe-route>/raw.html');
readmeLines.push('  pages/<safe-route>/rendered.html');
readmeLines.push('  pages/<safe-route>/page-spec.json');
readmeLines.push('  pages/<safe-route>/content.md');
readmeLines.push('  screenshots/desktop/*.png');
readmeLines.push('  screenshots/mobile/*.png');
readmeLines.push('  assets/');
readmeLines.push('  meta/');
readmeLines.push('```');
readmeLines.push('');
readmeLines.push('## raw.html vs rendered.html');
readmeLines.push('');
readmeLines.push(
  '- `raw.html` — initial HTTP response (often a Wix shell + embedded JSON).'
);
readmeLines.push(
  '- `rendered.html` — DOM after Wix client render, scrolling, and lazy-load. **Prefer this + page-spec + screenshots for reconstruction.**'
);
readmeLines.push('');
readmeLines.push('## How Cursor should use this archive');
readmeLines.push('');
readmeLines.push('For each route:');
readmeLines.push('1. Read `content.md` for verbatim Polish copy order.');
readmeLines.push(
  '2. Read `page-spec.json` for section sequence, CTAs, and image placement.'
);
readmeLines.push(
  '3. Open desktop/mobile screenshots for layout, crop, and hierarchy.'
);
readmeLines.push(
  '4. Resolve images via `image-placement.json` → local migrated paths.'
);
readmeLines.push('5. Check `clone-gap-analysis.md` for known gaps.');
readmeLines.push('6. Implement cleanly in Next.js — do not paste Wix markup.');
readmeLines.push('');
readmeLines.push('## Excluded pages');
readmeLines.push('');
for (const e of excluded) {
  readmeLines.push(
    `- \`${e.originalRoute}\` — ${e.exclusionReason || e.classification}`
  );
}
readmeLines.push('');
readmeLines.push('## Known limitations');
readmeLines.push('');
readmeLines.push(
  '- Wix booking calendars and some third-party widgets may remain interaction-dependent.'
);
readmeLines.push(
  '- Carousel slides not selected may need section-level follow-up screenshots.'
);
readmeLines.push('- Computed styles are samples, not a full CSS dump.');
readmeLines.push(
  '- Network-idle is best-effort; Wix analytics may keep connections open.'
);
readmeLines.push(
  '- `/warsztaty` returns HTTP 404 on the original site; evidence retained under `pages/warsztaty/`.'
);
readmeLines.push('');
readmeLines.push('## Rerun safely');
readmeLines.push('');
readmeLines.push('```bash');
readmeLines.push('node scripts/capture-original-site.js');
readmeLines.push('node scripts/reconcile-original-site-inventory.js');
readmeLines.push('node scripts/validate-original-site-reference.js');
readmeLines.push('```');
readmeLines.push('');
readmeLines.push(
  'Optional: `--limit=3`, `--only=/onas`, `--skip-screenshots`, `--discover-only`, `--skip-discover`, `--resume`.'
);
readmeLines.push('');
readmeLines.push('## Page index');
readmeLines.push('');
readmeLines.push(
  '| Route | Title | Raw | Rendered | Content | Spec | Desktop | Mobile | New route | Status |'
);
readmeLines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const p of included) {
  const title = (p.pageTitle || '').replace(/\|/g, '/');
  readmeLines.push(
    `| ${p.originalRoute} | ${title} | [raw](${p.rawHtmlPath}) | [rendered](${p.renderedHtmlPath}) | [md](${p.extractedContentPath}) | [spec](${p.pageSpecPath}) | [desk](${p.desktopScreenshotPath}) | [mob](${p.mobileScreenshotPath}) | ${p.newSiteRoute || '—'} | ${p.captureStatus} |`
  );
}
readmeLines.push('');
fs.writeFileSync(path.join(ROOT, 'README.md'), readmeLines.join('\n'));

const placement = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'image-placement.json'), 'utf8')
);
const unresolved = (placement.placements || []).filter(
  (p) => !p.resolvedLocally
);
const unresolvedSummary = unresolved.slice(0, 30).map((p) => ({
  page: p.originalRoute,
  mediaId: p.mediaId,
  src: (p.originalWixUrl || '').slice(0, 120),
  role: p.role,
  alt: p.altText,
}));

fs.writeFileSync(
  path.join(ROOT, 'meta', 'inventory-reconcile.json'),
  JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      updates,
      statuses: inventory.pages.reduce((acc, p) => {
        acc[p.captureStatus] = (acc[p.captureStatus] || 0) + 1;
        return acc;
      }, {}),
      unresolvedCount: unresolved.length,
      unresolvedSample: unresolvedSummary,
    },
    null,
    2
  )
);

console.log(
  JSON.stringify(
    {
      updates: updates.length,
      statuses: inventory.pages.reduce((acc, p) => {
        acc[p.captureStatus] = (acc[p.captureStatus] || 0) + 1;
        return acc;
      }, {}),
      unresolvedCount: unresolved.length,
    },
    null,
    2
  )
);
