'use strict';

/**
 * Validate Ceramika Nero clone closure: 99-URL accounting + live crawl checks.
 * Exit non-zero on substantive failures.
 *
 * Usage:
 *   node scripts/validate-clone-closure.js --base=http://127.0.0.1:3010
 *   node scripts/validate-clone-closure.js --skip-crawl
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const base =
  (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1] ||
  'http://127.0.0.1:3010';
const skipCrawl = process.argv.includes('--skip-crawl');

const inv = JSON.parse(
  fs.readFileSync(
    path.join(root, 'reference/original-site/page-inventory.json'),
    'utf8'
  )
);
const finalPath = path.join(
  root,
  'reference/original-site/implementation/clone-final.json'
);

const failures = [];
const warnings = [];

function fail(msg) {
  failures.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function encodePath(route) {
  return route
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(seg) : ''))
    .join('/');
}

async function fetchStatus(route) {
  const url = base.replace(/\/$/, '') + encodePath(route);
  const res = await fetch(url, { redirect: 'manual' });
  const location = res.headers.get('location');
  let body = '';
  if (res.status === 200) {
    body = await res.text();
  }
  return { status: res.status, location, body, url };
}

function loadFinalOrBuild() {
  if (fs.existsSync(finalPath)) {
    return JSON.parse(fs.readFileSync(finalPath, 'utf8'));
  }
  return null;
}

function assertNinetyNine(final) {
  const routes = final.routes || [];
  if (routes.length !== 99) {
    fail(`Expected 99 routes in clone-final.json, got ${routes.length}`);
  }
  const seen = new Set();
  for (const r of routes) {
    if (seen.has(r.originalRoute))
      fail(`Duplicate originalRoute ${r.originalRoute}`);
    seen.add(r.originalRoute);
  }
  for (const p of inv.pages) {
    if (!seen.has(p.originalRoute)) {
      fail(`Inventory route missing from final: ${p.originalRoute}`);
    }
  }
}

async function crawlImplemented(final) {
  const results = [];
  for (const r of final.routes) {
    const cls = r.finalClassification;
    if (
      cls === 'Formally excluded system/template route' ||
      cls === 'Retained 404 evidence' ||
      cls === 'Blocked with exact reason'
    ) {
      // Optional: confirm excluded return 404 (not required for all)
      continue;
    }

    if (cls === 'Permanent redirect') {
      const res = await fetchStatus(r.originalRoute);
      results.push({ route: r.originalRoute, ...res, expect: 'redirect' });
      if (![301, 302, 307, 308].includes(res.status)) {
        fail(`Redirect source ${r.originalRoute} returned ${res.status}`);
      } else {
        const dest = (res.location || '')
          .replace(base, '')
          .replace(/^https?:\/\/[^/]+/, '');
        const expected = r.redirectDestination;
        if (
          expected &&
          dest &&
          !dest.startsWith(expected) &&
          dest !== expected
        ) {
          // allow absolute or relative
          if (!dest.endsWith(expected) && dest !== expected) {
            warn(`Redirect ${r.originalRoute} → ${dest}, expected ${expected}`);
          }
        }
      }
      continue;
    }

    if (cls === 'Implemented directly') {
      const res = await fetchStatus(r.canonicalNewRoute || r.originalRoute);
      results.push({ route: r.originalRoute, ...res, expect: '200' });
      if (res.status !== 200) {
        fail(`Implemented route ${r.canonicalNewRoute} returned ${res.status}`);
        continue;
      }
      if (!res.body || res.body.length < 200) {
        fail(`Empty/thin page for ${r.canonicalNewRoute}`);
      }
      if (/wixstatic\.com|static\.wixstatic|parastorage\.com/i.test(res.body)) {
        fail(`Wix hotlink/runtime in HTML for ${r.canonicalNewRoute}`);
      }
      if (/<iframe/i.test(res.body) && /wix/i.test(res.body)) {
        fail(`Wix iframe in ${r.canonicalNewRoute}`);
      }
      if (
        /ceramikanero\.com\/(?!.*mailto)/i.test(res.body) &&
        /href=["']https?:\/\/www\.ceramikanero\.com/i.test(res.body)
      ) {
        warn(`Possible live-site link in ${r.canonicalNewRoute}`);
      }
      if (!/<title>/i.test(res.body)) {
        fail(`Missing title on ${r.canonicalNewRoute}`);
      }
      const h1 = (res.body.match(/<h1[\s>]/gi) || []).length;
      if (h1 === 0) warn(`No H1 on ${r.canonicalNewRoute}`);
      if (h1 > 2) warn(`Multiple H1 (${h1}) on ${r.canonicalNewRoute}`);
    }
  }
  return results;
}

async function main() {
  const final = loadFinalOrBuild();
  if (!final) {
    fail(
      'clone-final.json missing — run scripts/generate-clone-final.js first'
    );
    console.log(JSON.stringify({ ok: false, failures, warnings }, null, 2));
    process.exit(1);
  }

  assertNinetyNine(final);

  if (final.overallVerdict === 'Clone incomplete') {
    // Not a crawl failure; reported in summary
  }
  if (final.overallVerdict === 'Clone blocked pending user decision') {
    fail('Overall verdict is blocked pending user decision');
  }

  // Substantive: no Incomplete genuine routes unmarked
  for (const r of final.routes) {
    if (
      r.genuineCeramikaNeroContent === true &&
      r.finalClassification === 'Ambiguous and requiring user decision'
    ) {
      fail(`Ambiguous genuine route unresolved: ${r.originalRoute}`);
    }
  }

  let crawl = [];
  if (!skipCrawl) {
    try {
      crawl = await crawlImplemented(final);
    } catch (err) {
      fail(`Crawl failed: ${err.message || err}`);
    }
  } else {
    warn('Crawl skipped (--skip-crawl)');
  }

  const report = {
    validatedAt: new Date().toISOString(),
    base,
    skipCrawl,
    overallVerdict: final.overallVerdict,
    routeCount: final.routes.length,
    crawlChecked: crawl.length,
    failures,
    warnings,
    ok: failures.length === 0,
  };

  fs.mkdirSync(path.join(root, 'tmp/clone-closure'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tmp/clone-closure/validate-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
  process.exit(failures.length ? 1 : 0);
}

main();
