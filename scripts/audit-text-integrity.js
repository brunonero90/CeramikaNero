'use strict';

/**
 * Route-by-route text integrity vs archived page-spec / content.md.
 * Does NOT mutate Supabase.
 *
 *   node scripts/audit-text-integrity.js
 *   node scripts/audit-text-integrity.js --base=http://127.0.0.1:3010
 *   node scripts/audit-text-integrity.js --base=http://127.0.0.1:3010 --only=/urodziny,/panienskie
 *
 * With --base, uses Playwright against the live clone (SSR streaming shells
 * are empty under plain fetch). Without --base, checks content.md only.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'tmp/fidelity-audit');
const FINAL = require(
  path.join(ROOT, 'reference/original-site/implementation/clone-final.json')
);

const base =
  (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1] || '';
const onlyArg = (process.argv.find((a) => a.startsWith('--only=')) || '').split(
  '='
)[1];
const ONLY = onlyArg
  ? onlyArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

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

const FOOTER_NOISE =
  /zapisz się do newslettera|polityka prywatności|©\s*\d{4}|akceptuję regulamin|numer konta:|NIP\s*\d/i;

function normalizeText(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff​]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tokens(s) {
  return normalizeText(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
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

function expectedFromSpec(spec) {
  const headings = [];
  const paragraphs = [];
  const lists = [];
  for (const section of spec.sections || []) {
    if (
      FOOTER_NOISE.test(section.heading || '') &&
      /NIP/i.test(section.text || '')
    ) {
      continue;
    }
    for (const h of section.headings || []) {
      if (h && !FOOTER_NOISE.test(h)) headings.push(normalizeText(h));
    }
    // Strip Wix Bookings accessibility price echo ("209 złotych polskich")
    const raw = normalizeText(section.text || '').replace(
      /\d[\d\s]*(?:,\d+)?\s*złotych polskich/gi,
      ''
    );
    if (!raw || FOOTER_NOISE.test(raw.slice(0, 80))) continue;
    for (const block of raw.split(/\n\s*\n/)) {
      const t = block.trim();
      if (!t || t === '​' || FOOTER_NOISE.test(t)) continue;
      if (/^[■•]/.test(t) || t.includes('\n■') || t.includes('\n•')) {
        const items = t
          .split('\n')
          .map((l) => l.replace(/^[■•●▪◦]\s*/, '').trim())
          .filter(Boolean);
        if (items.length) lists.push(items);
      } else if (!headings.includes(t)) {
        paragraphs.push(t);
      }
    }
  }
  return { headings, paragraphs, lists };
}

function coverage(expectedTokens, haystackTokens) {
  if (!expectedTokens.length) return { ratio: 1, missing: [] };
  const set = new Set(haystackTokens);
  const missing = [];
  let hit = 0;
  for (const t of expectedTokens) {
    if (set.has(t)) hit += 1;
    else missing.push(t);
  }
  return { ratio: hit / expectedTokens.length, missing: missing.slice(0, 40) };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const routes = [];
  const seen = new Set();
  for (const r of FINAL.routes) {
    if (r.finalClassification === 'Implemented directly') {
      const route = r.originalRoute;
      if (ONLY && !ONLY.includes(route)) continue;
      if (seen.has(route)) continue;
      seen.add(route);
      routes.push({
        route,
        livePath: LIVE_PATH[route] || route,
      });
    } else if (r.finalClassification === 'Permanent redirect') {
      const evidenceRoute = r.originalRoute;
      const livePath = r.redirectDestination || r.canonicalNewRoute;
      if (!livePath) continue;
      // Only audit redirects that map archive evidence onto marketing live paths.
      const isAudienceAlias = Boolean(LIVE_PATH[evidenceRoute]);
      if (!isAudienceAlias) continue;
      if (ONLY && !ONLY.includes(evidenceRoute) && !ONLY.includes(livePath)) {
        continue;
      }
      if (seen.has(evidenceRoute)) continue;
      seen.add(evidenceRoute);
      routes.push({ route: evidenceRoute, livePath });
    }
  }

  const results = [];
  let browser = null;
  if (base) {
    const { chromium } = require('playwright');
    browser = await chromium.launch();
  }

  async function liveText(livePath) {
    const url = `${base.replace(/\/$/, '')}${livePath}`;
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForFunction(
        () => {
          const main = document.querySelector('main');
          const t = (main && main.innerText) || '';
          return t.length > 80 && !/Ładowanie strony/i.test(t);
        },
        { timeout: 30000 }
      );
      const text = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        return (main && main.innerText) || '';
      });
      return normalizeText(text);
    } finally {
      await page.close();
    }
  }

  for (const entry of routes) {
    const { route, livePath } = entry;
    const spec = loadPageSpec(route);
    const content = loadContentMd(route);
    if (!spec || !content) {
      results.push({
        route,
        livePath,
        status: 'missing-evidence',
        textExact: false,
        structureExact: false,
        notes: ['Missing page-spec or content.md'],
      });
      continue;
    }

    const expected = expectedFromSpec(spec);
    const expectedJoined = [
      ...expected.headings,
      ...expected.paragraphs,
      ...expected.lists.flat(),
    ].join('\n');
    const expectedTok = tokens(expectedJoined);

    let liveTok = [];
    let liveError = null;
    if (base) {
      try {
        liveTok = tokens(await liveText(livePath));
      } catch (err) {
        liveError = String(err.message || err);
      }
    }

    const contentTok = tokens(content);
    const vsContent = coverage(expectedTok, contentTok);
    const vsLive = base
      ? coverage(expectedTok, liveTok)
      : { ratio: null, missing: [] };

    const textExact =
      base && !liveError
        ? (vsLive.ratio || 0) >= 0.85
        : vsContent.ratio >= 0.98;

    results.push({
      route,
      livePath,
      status: liveError ? 'live-fetch-failed' : 'compared',
      textExact,
      structureExact: expected.headings.length > 0,
      headingCount: expected.headings.length,
      paragraphCount: expected.paragraphs.length,
      listCount: expected.lists.length,
      contentCoverage: Number(vsContent.ratio.toFixed(4)),
      liveCoverage:
        vsLive.ratio == null ? null : Number(vsLive.ratio.toFixed(4)),
      missingLiveTokens: vsLive.missing || [],
      liveError,
      notes: [
        ...(liveError ? [`Live fetch failed: ${liveError}`] : []),
        ...(textExact
          ? []
          : [
              base
                ? `Live token coverage ${((vsLive.ratio || 0) * 100).toFixed(1)}% (need ≥85%)`
                : `Content.md coverage ${(vsContent.ratio * 100).toFixed(1)}%`,
            ]),
      ],
    });
  }

  if (browser) await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    base: base || null,
    onlyFilter: ONLY,
    routeCount: results.length,
    textExactPass: results.filter((r) => r.textExact).length,
    textExactFail: results.filter((r) => r.textExact === false).length,
    missingEvidence: results.filter((r) => r.status === 'missing-evidence')
      .length,
    liveFetchFailed: results.filter((r) => r.status === 'live-fetch-failed')
      .length,
    cmsImportSafe: false,
    verdict:
      results.length > 0 &&
      results.every((r) => r.textExact || r.status === 'missing-evidence')
        ? 'Text integrity mostly ready — still verify screenshots'
        : 'Not yet faithful — text integrity failures remain',
  };

  const outJson = path.join(OUT, 'text-integrity.json');
  const outCsv = path.join(OUT, 'text-integrity.csv');
  fs.writeFileSync(
    outJson,
    JSON.stringify({ summary, routes: results }, null, 2)
  );
  fs.writeFileSync(
    outCsv,
    [
      'route,livePath,textExact,structureExact,headingCount,paragraphCount,listCount,contentCoverage,liveCoverage,status',
      ...results.map((r) =>
        [
          r.route,
          r.livePath,
          r.textExact,
          r.structureExact,
          r.headingCount ?? '',
          r.paragraphCount ?? '',
          r.listCount ?? '',
          r.contentCoverage ?? '',
          r.liveCoverage ?? '',
          r.status,
        ].join(',')
      ),
    ].join('\n')
  );
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${outJson}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
