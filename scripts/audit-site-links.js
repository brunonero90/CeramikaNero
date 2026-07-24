'use strict';

/**
 * Crawl rendered HTML for dead / placeholder / Wix links.
 * Usage: node scripts/audit-site-links.js [baseUrl]
 * Default baseUrl: http://127.0.0.1:3000
 */
const fs = require('fs');
const path = require('path');
const { load } = require('cheerio');

const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const outDir = path.join(process.cwd(), 'tmp/fidelity-repair');
fs.mkdirSync(outDir, { recursive: true });

const seedRoutes = [
  '/',
  '/pracownia',
  '/dla-dzieci',
  '/dla-doroslych',
  '/grupy-i-firmy',
  '/glinadowina',
  '/urodziny',
  '/panienskie',
  '/home',
  '/galeria',
  '/kontakt',
  '/blog',
  '/sklep',
  '/cart',
  '/vouchery',
  '/gift-card',
  '/faq',
  '/regulamin',
  '/terms-conditions',
  '/dostawy-i-zwroty',
  '/warsztaty',
  '/copy-of-panieński-opis',
  '/kopia-panieński-plus-opis',
  '/kopia-urodziny-ceramika',
];

async function fetchHtml(url) {
  const res = await fetch(url, { redirect: 'manual' });
  const text = res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), text };
}

function classifyHref(href, pagePath) {
  if (!href || href === '#') return { ok: false, issue: 'empty-or-hash' };
  if (href.startsWith('mailto:') || href.startsWith('tel:'))
    return { ok: true, issue: null };
  if (/wix\.com|wixsite\.com|wixstatic\.com/i.test(href))
    return { ok: false, issue: 'wix-host' };
  if (/^https?:\/\//i.test(href) && !/ceramikanero\.com/i.test(href))
    return { ok: true, issue: 'external' };
  let pathOnly = href.replace(/^https?:\/\/(www\.)?ceramikanero\.com/i, '');
  if (!pathOnly.startsWith('/')) pathOnly = pathOnly || '/';
  pathOnly = pathOnly.split('#')[0].split('?')[0];
  return { ok: true, issue: null, path: pathOnly, from: pagePath };
}

async function main() {
  const queue = [...seedRoutes];
  const seen = new Set();
  const clickables = [];
  const broken = [];
  const pathStatus = new Map();

  while (queue.length) {
    const route = queue.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    const url = base + encodeURI(route);
    let result;
    try {
      result = await fetchHtml(url);
    } catch (err) {
      broken.push({
        source: route,
        label: '(page fetch)',
        href: route,
        issue: `fetch-error: ${err.message}`,
      });
      continue;
    }
    pathStatus.set(route, result.status);
    if (result.status >= 300 && result.status < 400) continue;
    if (result.status >= 400) {
      broken.push({
        source: route,
        label: '(page)',
        href: route,
        issue: `status-${result.status}`,
      });
      continue;
    }

    const $ = load(result.text);
    $('a[href], button').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const href = tag === 'a' ? $(el).attr('href') || '' : '';
      const label = $(el).text().replace(/\s+/g, ' ').trim().slice(0, 80);
      if (tag === 'button' && !href) {
        clickables.push({
          source: route,
          label,
          href: '(button)',
          issue: 'button-no-href',
        });
        return;
      }
      const c = classifyHref(href, route);
      clickables.push({
        source: route,
        label,
        href,
        issue: c.issue,
        path: c.path,
      });
      if (!c.ok) {
        broken.push({
          source: route,
          label,
          href,
          issue: c.issue,
        });
      } else if (c.path && c.path.startsWith('/') && !seen.has(c.path)) {
        if (!c.path.startsWith('/admin') && !c.path.startsWith('/api')) {
          queue.push(c.path);
        }
      }
    });
  }

  // Verify internal destinations
  for (const item of clickables) {
    if (!item.path || !item.path.startsWith('/')) continue;
    if (item.path.startsWith('/admin') || item.path.startsWith('/api'))
      continue;
    if (!pathStatus.has(item.path)) {
      try {
        const r = await fetchHtml(base + encodeURI(item.path));
        pathStatus.set(item.path, r.status);
      } catch {
        pathStatus.set(item.path, 0);
      }
    }
    const status = pathStatus.get(item.path);
    if (!status || status >= 400) {
      broken.push({
        source: item.source,
        label: item.label,
        href: item.href,
        issue: `dest-status-${status || 0}`,
      });
    }
  }

  const report = {
    base,
    pagesCrawled: seen.size,
    clickables: clickables.length,
    broken: broken.length,
    brokenSample: broken.slice(0, 80),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(outDir, 'link-audit.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        pagesCrawled: report.pagesCrawled,
        clickables: report.clickables,
        broken: report.broken,
        out: 'tmp/fidelity-repair/link-audit.json',
      },
      null,
      2
    )
  );
  if (broken.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
