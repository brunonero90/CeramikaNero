'use strict';

/**
 * Full route visual + text-integrity audit against original-site evidence.
 * Does NOT mutate Supabase.
 *
 *   node scripts/audit-visual-fidelity.js
 *   node scripts/audit-visual-fidelity.js --capture --base=http://127.0.0.1:3010
 *
 * Outputs:
 *   tmp/fidelity-audit/manifest.json
 *   tmp/fidelity-audit/manifest.csv
 *   tmp/fidelity-audit/screenshots/{route}__{desktop|mobile}__{original|clone}.png
 *   tmp/fidelity-audit/diffs/{route}__{desktop|mobile}__diff.png (when sharp available)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'tmp/fidelity-audit');
const ORIG_SHOTS = path.join(ROOT, 'reference/original-site/screenshots');
const FINAL = require(
  path.join(ROOT, 'reference/original-site/implementation/clone-final.json')
);

const CAPTURE = process.argv.includes('--capture');
const base =
  (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1] ||
  'http://127.0.0.1:3010';
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').split(
  '='
)[1];
const ONLY = onlyArg
  ? onlyArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/** Map originalRoute → live Next path for screenshot capture. */
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

function safeName(route) {
  if (route === '/') return 'index';
  return route
    .replace(/^\//, '')
    .replace(/\//g, '__')
    .replace(/[<>:"|?*\\]/g, '_')
    .slice(0, 160);
}

function originalShot(route, viewport) {
  const name = safeName(route);
  return path.join(ORIG_SHOTS, viewport, `${name}.png`);
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function loadContentMd(route) {
  const rel = route === '/' ? 'index' : route.replace(/^\//, '');
  const file = path.join(
    ROOT,
    'reference/original-site/pages',
    rel,
    'content.md'
  );
  if (!fs.existsSync(file)) return null;
  return normalizeText(fs.readFileSync(file, 'utf8'));
}

function loadPageSpec(route) {
  const rel = route === '/' ? 'index' : route.replace(/^\//, '');
  const file = path.join(
    ROOT,
    'reference/original-site/pages',
    rel,
    'page-spec.json'
  );
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function textIntegrity(route) {
  const content = loadContentMd(route);
  const spec = loadPageSpec(route);
  if (!content || !spec) {
    return {
      status: 'missing-evidence',
      paragraphCount: null,
      headingCount: null,
      notes: ['Missing content.md or page-spec.json'],
    };
  }
  const headings = (spec.sections || []).flatMap((s) => s.headings || []);
  const bodyText = (spec.sections || []).map((s) => s.text || '').join('\n\n');
  return {
    status: 'evidence-ready',
    paragraphApprox: (bodyText.match(/\n\s*\n/g) || []).length + 1,
    headingCount: headings.length,
    contentChars: content.length,
    notes: [],
  };
}

function livePathFor(originalRoute) {
  if (LIVE_PATH[originalRoute]) return LIVE_PATH[originalRoute];
  // ASCII fold for public folders with ń
  return originalRoute.replace(/ń/g, 'n').replace(/Ń/g, 'n');
}

async function captureClone(browser, route, livePath, viewportName) {
  const page = await browser.newPage({
    viewport: VIEWPORTS[viewportName],
  });
  const url = base.replace(/\/$/, '') + livePath;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    const dir = path.join(OUT, 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(
      dir,
      `${safeName(route)}__${viewportName}__clone.png`
    );
    await page.screenshot({ path: file, fullPage: true });

    // Element-only chrome captures (exclude hero bleed from header %).
    const chromeDir = path.join(OUT, 'crops');
    fs.mkdirSync(chromeDir, { recursive: true });
    const headerEl = page.locator('[data-chrome="site-header"]');
    const footerEl = page.locator('[data-chrome="site-footer"]');
    const chrome = { header: null, footer: null };
    if ((await headerEl.count()) > 0) {
      const hf = path.join(
        chromeDir,
        `${safeName(route)}__${viewportName}__header-el__clone.png`
      );
      await headerEl.first().screenshot({ path: hf });
      const box = await headerEl.first().boundingBox();
      chrome.header = { file: hf, box };
    }
    if ((await footerEl.count()) > 0) {
      const ff = path.join(
        chromeDir,
        `${safeName(route)}__${viewportName}__footer-el__clone.png`
      );
      await footerEl.first().screenshot({ path: ff });
      const box = await footerEl.first().boundingBox();
      chrome.footer = { file: ff, box };
    }

    await page.close();
    return { ok: true, file, chrome };
  } catch (err) {
    await page.close().catch(() => {});
    return { ok: false, error: String(err.message || err) };
  }
}

async function cropRegion(src, outFile, region) {
  const sharp = require('sharp');
  const meta = await sharp(src).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  let top = 0;
  let h = height;
  if (region === 'header') {
    h = Math.min(97, height);
  } else if (region === 'footer') {
    h = Math.min(483, height);
    top = Math.max(0, height - h);
  } else if (region === 'body') {
    const headerH = Math.min(97, height);
    const footerH = Math.min(483, height);
    top = headerH;
    h = Math.max(100, height - headerH - footerH);
    h = Math.min(h, 1800);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(src).extract({ left: 0, top, width, height: h }).toFile(outFile);
  return { file: outFile, width, height: h, sourceHeight: height };
}

async function regionDiff(origSrc, cloneSrc, route, viewport, region) {
  const crops = path.join(OUT, 'crops');
  fs.mkdirSync(crops, { recursive: true });
  const baseName = `${safeName(route)}__${viewport}__${region}`;
  const origCrop = path.join(crops, `${baseName}__original.png`);
  const cloneCrop = path.join(crops, `${baseName}__clone.png`);
  const diffOut = path.join(OUT, 'diffs', `${baseName}__diff.png`);
  const oMeta = await cropRegion(origSrc, origCrop, region);
  const cMeta = await cropRegion(cloneSrc, cloneCrop, region);
  const diff = await maybeDiff(origCrop, cloneCrop, diffOut);
  return {
    ...diff,
    originalCrop: origCrop,
    cloneCrop: cloneCrop,
    diffFile: diff.ok ? diffOut : null,
    originalRegionHeight: oMeta.height,
    cloneRegionHeight: cMeta.height,
    originalPageHeight: oMeta.sourceHeight,
    clonePageHeight: cMeta.sourceHeight,
  };
}

async function maybeDiff(originalFile, cloneFile, outFile) {
  if (!fs.existsSync(originalFile) || !fs.existsSync(cloneFile)) {
    return { ok: false, reason: 'missing-input' };
  }
  try {
    const sharp = require('sharp');
    const a = sharp(originalFile);
    const b = sharp(cloneFile);
    const metaA = await a.metadata();
    const metaB = await b.metadata();
    const width = Math.min(metaA.width || 1, metaB.width || 1);
    const height = Math.min(metaA.height || 1, metaB.height || 1);
    const bufA = await a
      .resize(width, height, { fit: 'cover' })
      .raw()
      .ensureAlpha()
      .toBuffer();
    const bufB = await b
      .resize(width, height, { fit: 'cover' })
      .raw()
      .ensureAlpha()
      .toBuffer();
    const out = Buffer.alloc(bufA.length);
    let diff = 0;
    for (let i = 0; i < bufA.length; i += 4) {
      const dr = Math.abs(bufA[i] - bufB[i]);
      const dg = Math.abs(bufA[i + 1] - bufB[i + 1]);
      const db = Math.abs(bufA[i + 2] - bufB[i + 2]);
      const changed = dr + dg + db > 40;
      if (changed) diff += 1;
      out[i] = changed ? 255 : 0;
      out[i + 1] = 0;
      out[i + 2] = changed ? 0 : 0;
      out[i + 3] = 255;
    }
    const pixels = width * height;
    const ratio = diff / pixels;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    await sharp(out, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(outFile);
    return {
      ok: true,
      diffRatio: ratio,
      pixels,
      diffPixels: diff,
      width,
      height,
    };
  } catch (err) {
    return { ok: false, reason: String(err.message || err) };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const implemented = [];
  const seen = new Set();
  for (const r of FINAL.routes) {
    if (r.finalClassification === 'Implemented directly') {
      if (ONLY && !ONLY.includes(r.originalRoute)) continue;
      if (seen.has(r.originalRoute)) continue;
      seen.add(r.originalRoute);
      implemented.push(r);
    } else if (r.finalClassification === 'Permanent redirect') {
      const live = r.redirectDestination || r.canonicalNewRoute;
      if (!live) continue;
      if (!LIVE_PATH[r.originalRoute]) continue;
      if (ONLY && !ONLY.includes(r.originalRoute) && !ONLY.includes(live)) {
        continue;
      }
      if (seen.has(r.originalRoute)) continue;
      seen.add(r.originalRoute);
      implemented.push({
        ...r,
        finalClassification: 'Implemented directly',
        pageType: r.pageType || 'marketing',
        _liveOverride: live,
      });
    }
  }

  if (ONLY && implemented.length === 0) {
    console.error('No routes matched --only=', ONLY.join(','));
    process.exit(1);
  }

  let browser = null;
  if (CAPTURE) {
    browser = await chromium.launch();
  }

  const rows = [];
  for (const r of implemented) {
    const route = r.originalRoute;
    const livePath = r._liveOverride || livePathFor(route);
    const evidence = {
      contentMd: !!loadContentMd(route),
      pageSpec: !!loadPageSpec(route),
      desktopShot: fs.existsSync(originalShot(route, 'desktop')),
      mobileShot: fs.existsSync(originalShot(route, 'mobile')),
      renderedHtml: fs.existsSync(
        path.join(
          ROOT,
          'reference/original-site/pages',
          route === '/' ? 'index' : route.replace(/^\//, ''),
          'rendered.html'
        )
      ),
    };
    const text = textIntegrity(route);

    const row = {
      route,
      livePath,
      pageType: r.pageType,
      originalEvidence: evidence,
      desktopChecked: false,
      mobileChecked: false,
      textExact: null,
      structureExact: null,
      visualStatus: 'not-yet-inspected',
      remainingDifferences: [
        'Awaiting screenshot inspection after capture',
        'Heuristic heading promotion removed; page-spec knownHeadings wired for archive pages',
      ],
      textIntegrity: text,
      captures: {},
      diffs: {},
    };

    if (CAPTURE && browser) {
      for (const vp of ['desktop', 'mobile']) {
        const orig = originalShot(route, vp);
        const cap = await captureClone(browser, route, livePath, vp);
        row.captures[vp] = cap;
        if (cap.ok) {
          if (vp === 'desktop') row.desktopChecked = true;
          if (vp === 'mobile') row.mobileChecked = true;
          // Copy original beside clone for side-by-side review
          if (fs.existsSync(orig)) {
            const dest = path.join(
              OUT,
              'screenshots',
              `${safeName(route)}__${vp}__original.png`
            );
            fs.copyFileSync(orig, dest);
            const diffOut = path.join(
              OUT,
              'diffs',
              `${safeName(route)}__${vp}__diff.png`
            );
            row.diffs[vp] = await maybeDiff(orig, cap.file, diffOut);
            row.regionDiffs = row.regionDiffs || {};
            row.regionDiffs[vp] = {
              header: await regionDiff(orig, cap.file, route, vp, 'header'),
              body: await regionDiff(orig, cap.file, route, vp, 'body'),
              footer: await regionDiff(orig, cap.file, route, vp, 'footer'),
            };
            const dims = {
              originalPageHeight: row.regionDiffs[vp].header.originalPageHeight,
              clonePageHeight: row.regionDiffs[vp].header.clonePageHeight,
              heightDeltaPx:
                (row.regionDiffs[vp].header.clonePageHeight || 0) -
                (row.regionDiffs[vp].header.originalPageHeight || 0),
            };
            row.dimensions = row.dimensions || {};
            row.dimensions[vp] = dims;
            if (row.diffs[vp].ok) {
              const ratio = row.diffs[vp].diffRatio;
              const hRatio = row.regionDiffs[vp].header.diffRatio;
              const bRatio = row.regionDiffs[vp].body.diffRatio;
              const fRatio = row.regionDiffs[vp].footer.diffRatio;
              row.remainingDifferences.push(
                `${vp} full ${(ratio * 100).toFixed(1)}% | header ${((hRatio || 0) * 100).toFixed(1)}% | body ${((bRatio || 0) * 100).toFixed(1)}% | footer ${((fRatio || 0) * 100).toFixed(1)}% | Δh ${dims.heightDeltaPx}px`
              );
              if (ratio > 0.12) {
                row.visualStatus = 'material-diff';
              } else if (ratio > 0.04) {
                row.visualStatus =
                  row.visualStatus === 'material-diff'
                    ? 'material-diff'
                    : 'minor-diff';
              } else {
                row.visualStatus =
                  row.visualStatus === 'material-diff'
                    ? 'material-diff'
                    : 'close';
              }
            }
          } else {
            row.remainingDifferences.push(`Missing original ${vp} screenshot`);
          }
        } else {
          row.remainingDifferences.push(
            `Clone capture failed (${vp}): ${cap.error}`
          );
          row.visualStatus = 'capture-failed';
        }
      }
    }

    // FAQ known Wix template pollution
    if (route === '/faq') {
      row.remainingDifferences.push(
        'Archived FAQ content includes Wix editor template questions — cannot invent real studio FAQs without business copy'
      );
      row.visualStatus = 'blocked-by-archive-evidence';
    }

    rows.push(row);
  }

  if (browser) await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    captureMode: CAPTURE,
    base: CAPTURE ? base : null,
    routeCount: rows.length,
    byVisualStatus: rows.reduce((acc, r) => {
      acc[r.visualStatus] = (acc[r.visualStatus] || 0) + 1;
      return acc;
    }, {}),
    rootCausesAddressed: [
      'parseArchiveText no longer invents headings from short/uppercase lines',
      'ArchiveRichText accepts knownHeadings from page-spec.json',
      'MarketingHero/ImageTextSplit preserve multi-line titles with <br/>',
      'urodziny/panienskie titles and intros aligned to page-spec evidence',
      'ArchivePageView skips captured footer chrome and heading duplicates',
      'Marketing split titles keep original casing (no forced uppercase)',
      'CMS split-block preserves framed/textAlign for round-trip',
    ],
    onlyFilter: ONLY,
    cmsImportSafe: false,
    productionMutation: false,
    verdict: CAPTURE
      ? 'Not yet faithful — capture run completed; inspect diffs route-by-route'
      : 'Not yet faithful — run with --capture against a live server for screenshots',
  };

  const manifest = { summary, routes: rows };
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT, 'manifest.csv'),
    [
      'route,livePath,pageType,desktopChecked,mobileChecked,visualStatus,textStatus',
      ...rows.map((r) =>
        [
          r.route,
          r.livePath,
          r.pageType,
          r.desktopChecked,
          r.mobileChecked,
          r.visualStatus,
          r.textIntegrity.status,
        ].join(',')
      ),
    ].join('\n')
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
