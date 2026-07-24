'use strict';

/**
 * Capture the live Ceramika Nero Wix site into reference/original-site/.
 * Reference archive only — do not serve captured HTML in production.
 *
 * Usage:
 *   node scripts/capture-original-site.js
 *   node scripts/capture-original-site.js --limit=3
 *   node scripts/capture-original-site.js --only=/onas
 *   node scripts/capture-original-site.js --skip-screenshots
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  ORIGIN,
  ROOT,
  normalizeUrl,
  decodePathname,
  toSafeRoute,
  classifyUrl,
  mapNewRoute,
  extractWixMediaId,
} = require('./lib/original-site-paths');

const args = process.argv.slice(2);
const LIMIT = Number(
  (args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0
);
const ONLY = (args.find((a) => a.startsWith('--only=')) || '')
  .split('=')
  .slice(1)
  .join('=');
const SKIP_SHOTS = args.includes('--skip-screenshots');
const DISCOVER_ONLY = args.includes('--discover-only');
const SKIP_DISCOVER =
  args.includes('--skip-discover') &&
  fs.existsSync(path.join(ROOT, 'page-inventory.json'));
const RESUME = args.includes('--resume');

const CAPTURE_DATE = new Date().toISOString();

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(file, text) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, text, 'utf8');
}

function rel(p) {
  return path.relative(process.cwd(), p).split(path.sep).join('/');
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent':
        'CeramikaNeroReferenceCapture/1.0 (+local archive; not a bot abuse)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    finalUrl: res.url,
    text,
    headers: Object.fromEntries(res.headers.entries()),
  };
}

function extractLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) {
    locs.push(m[1].trim());
  }
  return locs;
}

async function discoverPages() {
  const discoverySources = new Map(); // canonicalHref -> Set<source>
  function add(url, source) {
    const n = normalizeUrl(url);
    if (!n) return;
    const key = n.canonicalHref;
    if (!discoverySources.has(key)) discoverySources.set(key, new Set());
    discoverySources.get(key).add(source);
  }

  const robots = await fetchText(`${ORIGIN}/robots.txt`);
  writeText(path.join(ROOT, 'meta', 'robots.txt'), robots.text || '');

  const sitemapUrls = [
    `${ORIGIN}/sitemap.xml`,
    `${ORIGIN}/pages-sitemap.xml`,
    `${ORIGIN}/blog-posts-sitemap.xml`,
    `${ORIGIN}/blog-categories-sitemap.xml`,
    `${ORIGIN}/booking-services-sitemap.xml`,
    `${ORIGIN}/store-products-sitemap.xml`,
    `${ORIGIN}/event-pages-sitemap.xml`,
    `${ORIGIN}/pricing-plans-sitemap.xml`,
  ];

  // Also pull nested sitemaps from index
  const indexProbe = await fetchText(`${ORIGIN}/sitemap.xml`);
  if (indexProbe.ok) {
    for (const loc of extractLocs(indexProbe.text)) {
      if (loc.includes('sitemap') && loc.endsWith('.xml')) {
        sitemapUrls.push(loc);
      } else {
        add(loc, 'sitemap.xml');
      }
    }
  }

  const sitemapReport = [];
  for (const sm of [...new Set(sitemapUrls)]) {
    try {
      const r = await fetchText(sm);
      const locs = r.ok ? extractLocs(r.text) : [];
      sitemapReport.push({
        url: sm,
        status: r.status,
        ok: r.ok,
        locCount: locs.length,
      });
      for (const loc of locs) {
        if (loc.includes('sitemap') && loc.endsWith('.xml')) {
          const nested = await fetchText(loc);
          const nestedLocs = nested.ok ? extractLocs(nested.text) : [];
          sitemapReport.push({
            url: loc,
            status: nested.status,
            ok: nested.ok,
            locCount: nestedLocs.length,
          });
          for (const nloc of nestedLocs) add(nloc, path.basename(loc));
        } else {
          add(loc, path.basename(sm));
        }
      }
    } catch (err) {
      sitemapReport.push({
        url: sm,
        ok: false,
        error: String(err.message || err),
      });
    }
  }

  // Seed known marketing URLs + prior crawl inventory
  const seeds = [
    '/',
    '/onas',
    '/dladzieci',
    '/dladoroslych',
    '/home',
    '/glinadowina',
    '/urodziny',
    '/dlafirm',
    '/panienskie',
    '/galeria',
    '/kontakt',
    '/blog',
    '/warsztaty',
    '/sklep',
    '/cart',
    '/regulamin',
    '/terms-conditions',
    '/faq',
    '/dostawy-i-zwroty',
    '/vouchery',
    '/gift-card',
    '/courses',
    '/services',
    '/services/glina-do-wina',
  ];
  for (const s of seeds) add(`${ORIGIN}${s}`, 'seed');

  // Prior crawl pages
  const priorPath = path.join(
    process.cwd(),
    'tmp',
    'wix-crawl',
    'page-discovery.json'
  );
  if (fs.existsSync(priorPath)) {
    const prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
    for (const p of prior.pages || []) add(p, 'prior-crawl');
    for (const p of prior.orphanUrlsOutsideOrdinaryNavigation || []) {
      add(p, 'prior-orphan-sitemap');
    }
  }

  // BFS link crawl from homepage (limited depth) for nav/footer/content links
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CeramikaNeroReferenceCapture/1.0',
    locale: 'pl-PL',
  });
  const page = await context.newPage();
  const queue = [`${ORIGIN}/`];
  const seen = new Set();
  while (queue.length && seen.size < 120) {
    const url = queue.shift();
    const n = normalizeUrl(url);
    if (!n || seen.has(n.canonicalHref)) continue;
    seen.add(n.canonicalHref);
    add(n.canonicalHref, seen.size === 1 ? 'homepage' : 'in-page-link');
    try {
      await page.goto(n.canonicalHref, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(2500);
      const hrefs = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('a[href]').forEach((a) => {
          out.push(a.href);
        });
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical?.href) out.push(canonical.href);
        return out;
      });
      for (const h of hrefs) {
        const hn = normalizeUrl(h);
        if (!hn) continue;
        add(hn.canonicalHref, 'in-page-link');
        if (!seen.has(hn.canonicalHref) && queue.length < 200) {
          queue.push(hn.canonicalHref);
        }
      }
      // Try load-more / show more on blog-like pages
      for (let i = 0; i < 4; i++) {
        const clicked = await page.evaluate(() => {
          const candidates = [
            ...document.querySelectorAll('button, a, [role="button"]'),
          ];
          const btn = candidates.find((el) =>
            /więcej|more|load|pokaż|dalej|next/i.test(
              (el.textContent || '').trim()
            )
          );
          if (btn) {
            btn.click();
            return true;
          }
          return false;
        });
        if (!clicked) break;
        await page.waitForTimeout(1500);
        const more = await page.evaluate(() =>
          [...document.querySelectorAll('a[href]')].map((a) => a.href)
        );
        for (const h of more) {
          const hn = normalizeUrl(h);
          if (hn) add(hn.canonicalHref, 'load-more');
        }
      }
    } catch {
      // continue discovery
    }
  }
  await browser.close();

  const entries = [];
  for (const [canonicalHref, sources] of [
    ...discoverySources.entries(),
  ].sort()) {
    const n = normalizeUrl(canonicalHref);
    if (!n) continue;
    const pathnameDecoded = decodePathname(n.pathname);
    const classification = classifyUrl(pathnameDecoded);
    const safeRoute = toSafeRoute(pathnameDecoded);
    const pageDir = path.join(ROOT, 'pages', safeRoute);
    entries.push({
      originalUrl: canonicalHref,
      canonicalUrl: canonicalHref,
      originalRoute: pathnameDecoded,
      pageTitle: null,
      pageType: classification.pageType || 'other',
      discoverySources: [...sources].sort(),
      redirect: null,
      captureStatus: classification.include ? 'pending' : 'excluded',
      classification: classification.classification,
      exclusionReason: classification.include ? null : classification.reason,
      rawHtmlPath: classification.include
        ? rel(path.join(pageDir, 'raw.html'))
        : null,
      renderedHtmlPath: classification.include
        ? rel(path.join(pageDir, 'rendered.html'))
        : null,
      desktopScreenshotPath: classification.include
        ? rel(
            path.join(
              ROOT,
              'screenshots',
              'desktop',
              `${safeRoute.replace(/\//g, '__')}.png`
            )
          )
        : null,
      mobileScreenshotPath: classification.include
        ? rel(
            path.join(
              ROOT,
              'screenshots',
              'mobile',
              `${safeRoute.replace(/\//g, '__')}.png`
            )
          )
        : null,
      extractedContentPath: classification.include
        ? rel(path.join(pageDir, 'content.md'))
        : null,
      pageSpecPath: classification.include
        ? rel(path.join(pageDir, 'page-spec.json'))
        : null,
      newSiteRoute: mapNewRoute(pathnameDecoded),
      safeRoute,
    });
  }

  const inventory = {
    generatedAt: CAPTURE_DATE,
    originalSite: ORIGIN + '/',
    robotsOk: robots.ok,
    sitemapReport,
    totals: {
      discovered: entries.length,
      included: entries.filter((e) => e.captureStatus !== 'excluded').length,
      excluded: entries.filter((e) => e.captureStatus === 'excluded').length,
    },
    pages: entries,
  };

  writeJson(path.join(ROOT, 'page-inventory.json'), inventory);
  writeJson(path.join(ROOT, 'meta', 'sitemap-report.json'), sitemapReport);
  return inventory;
}

async function safeEvaluate(page, fn, arg) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return arg === undefined
        ? await page.evaluate(fn)
        : await page.evaluate(fn, arg);
    } catch (err) {
      const msg = String(err.message || err);
      if (
        /Execution context was destroyed|Target closed|navigation/i.test(msg)
      ) {
        await page.waitForTimeout(1500);
        try {
          await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        } catch {
          /* continue */
        }
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function settlePage(page) {
  await page.waitForTimeout(2000);
  // Progressive scroll to trigger lazy load
  await safeEvaluate(page, async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const height = () =>
      Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0
      );
    let y = 0;
    let guard = 0;
    while (y < height() && guard < 60) {
      y += Math.max(500, window.innerHeight * 0.9);
      window.scrollTo(0, y);
      await sleep(280);
      guard += 1;
    }
    window.scrollTo(0, 0);
    await sleep(300);
  });

  // Expand in-page accordions only (never <a href> navigations)
  await safeEvaluate(page, () => {
    const clickables = [
      ...document.querySelectorAll(
        'button, [role="button"], [aria-expanded="false"], details:not([open]) > summary'
      ),
    ];
    for (const el of clickables) {
      if (el.closest('a[href]')) continue;
      const t = (el.textContent || '').trim();
      if (t.length > 80) continue;
      if (
        /więcej|rozwiń|expand|show more|details|pokaż|faq/i.test(t) ||
        el.getAttribute('aria-expanded') === 'false'
      ) {
        try {
          el.click();
        } catch {
          /* ignore */
        }
      }
    }
  });
  await page.waitForTimeout(600);

  // Load-more loops — buttons only, not links
  for (let i = 0; i < 5; i++) {
    const clicked = await safeEvaluate(page, () => {
      const nodes = [...document.querySelectorAll('button, [role="button"]')];
      const btn = nodes.find((el) => {
        if (el.closest('a[href]')) return false;
        const t = (el.textContent || '').trim();
        return /załaduj|load more|więcej post|pokaż więcej|see more|load more/i.test(
          t
        );
      });
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(1400);
  }

  await safeEvaluate(page, async () => {
    const imgs = [...document.images];
    await Promise.all(
      imgs.slice(0, 100).map(
        (img) =>
          img.complete ||
          new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 1500);
          })
      )
    );
  });

  try {
    await page.waitForLoadState('networkidle', { timeout: 6000 });
  } catch {
    /* Wix often never fully idles */
  }
  await page.waitForTimeout(800);
}

async function extractPageData(page, entry, mediaById) {
  return safeEvaluate(
    page,
    ({ route, mediaLookup }) => {
      const abs = (u) => {
        try {
          return new URL(u, location.href).href;
        } catch {
          return u;
        }
      };

      const extractMediaId = (url) => {
        if (!url) return null;
        const m = String(url).match(
          /(?:static\.wixstatic\.com\/media\/)([a-z0-9_]+)/i
        );
        return m ? m[1] : null;
      };

      const visibleText = (el) => {
        if (!el) return '';
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden')
          return '';
        return (el.innerText || '').replace(/\u00a0/g, ' ').trim();
      };

      // Prefer large section-like containers
      const sectionCandidates = [
        ...document.querySelectorAll(
          'section, [data-testid="mesh-container-content"] > div, [id^="comp-"].wixui-section, [data-mesh-id]'
        ),
      ].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 80 && r.width > 200;
      });

      // Deduplicate nested sections: keep top-level-ish by y order
      const sections = [];
      const used = new Set();
      for (const el of sectionCandidates.sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
      )) {
        if ([...used].some((p) => p.contains(el) || el.contains(p))) {
          // skip deep nests when parent already captured
          if ([...used].some((p) => p.contains(el))) continue;
        }
        used.add(el);
        sections.push(el);
        if (sections.length >= 40) break;
      }

      // Fallback: use body children blocks
      if (sections.length < 2) {
        const main =
          document.querySelector('main') ||
          document.querySelector('#SITE_PAGES') ||
          document.body;
        sections.length = 0;
        for (const child of [...main.children]) {
          if (child.getBoundingClientRect().height > 60) sections.push(child);
        }
      }

      const pageSections = sections.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const headings = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .map((h) => visibleText(h))
          .filter(Boolean);
        const buttons = [...el.querySelectorAll('a, button')]
          .map((a) => ({
            text: visibleText(a).slice(0, 200),
            href:
              a.tagName === 'A' ? abs(a.getAttribute('href') || a.href) : null,
          }))
          .filter((b) => b.text);

        const images = [];
        const imgEls = [
          ...el.querySelectorAll(
            'img, [style*="background-image"], [data-src], [data-image-info]'
          ),
        ];
        imgEls.forEach((node, imgIndex) => {
          let src =
            node.getAttribute('src') ||
            node.getAttribute('data-src') ||
            node.currentSrc ||
            '';
          if (!src && node.style?.backgroundImage) {
            const m = node.style.backgroundImage.match(
              /url\(["']?(.*?)["']?\)/
            );
            if (m) src = m[1];
          }
          if (!src) return;
          src = abs(src);
          if (
            /data:image\/svg|\.svg#|pixel|tracking|facebook\.com\/tr/i.test(src)
          )
            return;
          const r = node.getBoundingClientRect();
          const mediaId = extractMediaId(src);
          const local =
            mediaId && mediaLookup[mediaId] ? mediaLookup[mediaId] : null;
          images.push({
            order: imgIndex,
            src,
            mediaId,
            localPath: local,
            alt: node.getAttribute('alt') || '',
            role:
              cs.backgroundImage?.includes('url') && node.tagName !== 'IMG'
                ? 'background'
                : 'content',
            desktop: {
              width: Math.round(r.width),
              height: Math.round(r.height),
              top: Math.round(r.top + window.scrollY),
              left: Math.round(r.left + window.scrollX),
            },
            objectFit: cs.objectFit || null,
            objectPosition: cs.objectPosition || null,
          });
        });

        const forms = [...el.querySelectorAll('form')].map((form) => ({
          action: form.getAttribute('action'),
          method: form.getAttribute('method'),
          fields: [...form.querySelectorAll('input, textarea, select')].map(
            (f) => ({
              name: f.getAttribute('name'),
              type: f.getAttribute('type') || f.tagName.toLowerCase(),
              placeholder: f.getAttribute('placeholder'),
              required: f.required || false,
              label:
                (f.labels && f.labels[0] && f.labels[0].innerText) ||
                f.getAttribute('aria-label') ||
                null,
            })
          ),
        }));

        const text = visibleText(el);
        let sectionType = 'content';
        if (index === 0 && rect.top < 120) sectionType = 'hero';
        if (/nav|menu/i.test(el.id + el.className)) sectionType = 'navigation';
        if (
          /footer/i.test(el.id + el.className) ||
          index === sections.length - 1
        )
          sectionType =
            sectionType === 'hero' ? sectionType : 'footer-or-closing';
        if (images.length >= 4) sectionType = 'gallery-or-grid';
        if (forms.length) sectionType = 'form';

        return {
          index: index + 1,
          sectionType,
          heading: headings[0] || null,
          headings,
          text,
          buttons: buttons.slice(0, 30),
          images,
          forms,
          desktopLayout: {
            top: Math.round(rect.top + window.scrollY),
            height: Math.round(rect.height),
            width: Math.round(rect.width),
            backgroundColor: cs.backgroundColor,
            backgroundImage: cs.backgroundImage,
            textAlign: cs.textAlign,
            padding: cs.padding,
            display: cs.display,
            gap: cs.gap || null,
          },
        };
      });

      // Design tokens sample
      const bodyCs = window.getComputedStyle(document.body);
      const h1 = document.querySelector('h1');
      const h1Cs = h1 ? window.getComputedStyle(h1) : null;
      const btn = document.querySelector('a[href], button');
      const btnCs = btn ? window.getComputedStyle(btn) : null;

      const designSample = {
        body: {
          fontFamily: bodyCs.fontFamily,
          fontSize: bodyCs.fontSize,
          color: bodyCs.color,
          backgroundColor: bodyCs.backgroundColor,
        },
        h1: h1Cs
          ? {
              fontFamily: h1Cs.fontFamily,
              fontSize: h1Cs.fontSize,
              fontWeight: h1Cs.fontWeight,
              color: h1Cs.color,
              lineHeight: h1Cs.lineHeight,
            }
          : null,
        button: btnCs
          ? {
              fontFamily: btnCs.fontFamily,
              fontSize: btnCs.fontSize,
              backgroundColor: btnCs.backgroundColor,
              color: btnCs.color,
              borderRadius: btnCs.borderRadius,
              padding: btnCs.padding,
              border: btnCs.border,
            }
          : null,
        viewportWidth: window.innerWidth,
        documentHeight: Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        ),
      };

      // Wix app data snippets
      const wixData = {};
      const scripts = [...document.querySelectorAll('script')];
      for (const s of scripts) {
        const t = s.textContent || '';
        if (
          t.includes('warmupData') ||
          t.includes('publicModel') ||
          t.includes('routerData')
        ) {
          wixData.hasInlineAppData = true;
          wixData.inlineLength = (wixData.inlineLength || 0) + t.length;
        }
      }
      const warmup = document.getElementById('wix-warmup-data');
      if (warmup?.textContent) {
        wixData.warmupDataChars = warmup.textContent.length;
      }

      const fullText = visibleText(document.body);
      const title = document.title || '';
      const links = [...document.querySelectorAll('a[href]')].map((a) => ({
        text: visibleText(a).slice(0, 120),
        href: abs(a.href),
      }));

      return {
        title,
        fullText,
        sections: pageSections,
        designSample,
        wixData,
        linkCount: links.length,
        internalLinks: links
          .filter((l) => /ceramikanero\.com/i.test(l.href))
          .slice(0, 200),
        consoleNote: null,
      };
    },
    { route: entry.originalRoute, mediaLookup: mediaById }
  );
}

function buildContentMd(entry, data) {
  const lines = [];
  lines.push(`# ${data.title || entry.originalRoute}`);
  lines.push('');
  lines.push(`- Original URL: ${entry.canonicalUrl}`);
  lines.push(`- Route: ${entry.originalRoute}`);
  lines.push(`- Captured: ${CAPTURE_DATE}`);
  lines.push('');
  for (const section of data.sections || []) {
    lines.push(
      `## Section ${section.index}${section.heading ? `: ${section.heading}` : ''}`
    );
    lines.push('');
    if (section.text) {
      lines.push(section.text);
      lines.push('');
    }
    if (section.buttons?.length) {
      lines.push('### Buttons / links');
      for (const b of section.buttons) {
        lines.push(`- ${b.text}${b.href ? ` → ${b.href}` : ''}`);
      }
      lines.push('');
    }
    if (section.images?.length) {
      lines.push('### Images');
      for (const img of section.images) {
        lines.push(
          `- ${img.alt || '(no alt)'} | ${img.localPath || img.src} | ${img.desktop.width}x${img.desktop.height}`
        );
      }
      lines.push('');
    }
  }
  lines.push('## Full page text (verbatim visible order)');
  lines.push('');
  lines.push(data.fullText || '');
  lines.push('');
  return lines.join('\n');
}

function loadMediaLookup() {
  const mappingPath = path.join(
    process.cwd(),
    'tmp',
    'wix-crawl',
    'image-mapping.json'
  );
  const byId = {};
  if (fs.existsSync(mappingPath)) {
    const arr = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
    for (const item of arr) {
      if (item.id && item.localPath) byId[item.id] = item.localPath;
    }
  }
  // Also scan public folder
  const dir = path.join(process.cwd(), 'public', 'images', 'wix-migrated');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      const id = f.replace(/\.[^.]+$/, '');
      if (!byId[id]) byId[id] = `/images/wix-migrated/${f}`;
    }
  }
  return byId;
}

async function capturePage(
  context,
  entry,
  mediaById,
  imagePlacements,
  designSamples,
  errors
) {
  const pageDir = path.join(ROOT, 'pages', entry.safeRoute);
  ensureDir(pageDir);
  ensureDir(path.join(ROOT, 'screenshots', 'desktop'));
  ensureDir(path.join(ROOT, 'screenshots', 'mobile'));
  ensureDir(path.join(ROOT, 'meta', 'wix-data'));

  const pageErrors = [];
  const missing = [];

  // Raw HTML
  let raw;
  try {
    raw = await fetchText(entry.canonicalUrl);
  } catch (err) {
    raw = {
      ok: false,
      status: 0,
      text: '',
      finalUrl: entry.canonicalUrl,
      error: String(err),
    };
  }
  writeText(path.join(pageDir, 'raw.html'), raw.text || '');
  if (
    raw.finalUrl &&
    normalizeUrl(raw.finalUrl)?.canonicalHref !== entry.canonicalUrl
  ) {
    entry.redirect = {
      from: entry.canonicalUrl,
      to: raw.finalUrl,
      status: raw.status,
    };
  }

  const page = await context.newPage();
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (/wixstatic|ceramikanero|parastorage/i.test(u)) {
      missing.push({ url: u, error: req.failure()?.errorText || 'failed' });
    }
  });

  let gotoError = null;
  try {
    await page.goto(entry.canonicalUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });
  } catch (err) {
    gotoError = String(err.message || err);
  }

  await settlePage(page);

  const rendered = await page.content();
  writeText(path.join(pageDir, 'rendered.html'), rendered);

  // Save useful warmup JSON if present
  try {
    const warmup = await page.locator('#wix-warmup-data').count();
    if (warmup) {
      const text = await page.locator('#wix-warmup-data').textContent();
      if (text && text.length > 20) {
        writeText(
          path.join(
            ROOT,
            'meta',
            'wix-data',
            `${entry.safeRoute.replace(/\//g, '__')}.json`
          ),
          text
        );
      }
    }
  } catch {
    /* optional */
  }

  let desktopData = await extractPageData(page, entry, mediaById);
  if (!desktopData) {
    await page.waitForTimeout(2000);
    desktopData = await extractPageData(page, entry, mediaById);
  }
  if (!desktopData) {
    throw new Error('Failed to extract page data after retries');
  }
  entry.pageTitle = desktopData.title;

  // Desktop screenshot
  const shotName = `${entry.safeRoute.replace(/\//g, '__')}.png`;
  const desktopMeta = {
    viewport: { width: 1440, height: 900 },
    documentHeight: desktopData.designSample?.documentHeight || null,
    captureTimestamp: new Date().toISOString(),
    missingResources: missing.slice(0, 50),
    browserErrors: pageErrors.slice(0, 30),
    gotoError,
  };

  if (!SKIP_SHOTS) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await settlePage(page);
    await page.screenshot({
      path: path.join(ROOT, 'screenshots', 'desktop', shotName),
      fullPage: true,
    });
    desktopMeta.documentHeight = await page.evaluate(() =>
      Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      )
    );
  }

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await settlePage(page);
  const mobileData = (await extractPageData(page, entry, mediaById)) || {
    sections: [],
    designSample: null,
    fullText: '',
    title: desktopData.title,
  };
  if (!SKIP_SHOTS) {
    await page.screenshot({
      path: path.join(ROOT, 'screenshots', 'mobile', shotName),
      fullPage: true,
    });
  }

  // Merge mobile image dims into placements
  const mobileBySrc = new Map();
  for (const sec of mobileData.sections || []) {
    for (const img of sec.images || []) {
      mobileBySrc.set(img.src, img.desktop);
    }
  }

  for (const sec of desktopData.sections || []) {
    for (const img of sec.images || []) {
      const mediaId = img.mediaId || extractWixMediaId(img.src);
      imagePlacements.push({
        originalPage: entry.canonicalUrl,
        originalRoute: entry.originalRoute,
        sectionNumber: sec.index,
        sectionHeading: sec.heading,
        originalWixUrl: img.src,
        mediaId,
        localPath: img.localPath || (mediaId && mediaById[mediaId]) || null,
        altText: img.alt || '',
        positionInSection: img.order,
        orderAmongImages: img.order,
        desktopDimensions: img.desktop,
        mobileDimensions: mobileBySrc.get(img.src) || null,
        aspectRatio:
          img.desktop.width && img.desktop.height
            ? Number((img.desktop.width / img.desktop.height).toFixed(4))
            : null,
        objectFit: img.objectFit,
        objectPosition: img.objectPosition,
        role: img.role || 'content',
        surroundingHeading: sec.heading,
        surroundingTextExcerpt: (sec.text || '').slice(0, 240),
        linkDestination: null,
        resolvedLocally: Boolean(
          img.localPath || (mediaId && mediaById[mediaId])
        ),
      });
    }
  }

  designSamples.push({
    route: entry.originalRoute,
    desktop: desktopData.designSample,
    mobile: mobileData.designSample,
  });

  const pageSpec = {
    route: entry.originalRoute,
    canonicalUrl: entry.canonicalUrl,
    pageTitle: desktopData.title,
    pageType: entry.pageType,
    headerNavigationVariant: 'wix-site-header',
    footerVariant: 'wix-site-footer',
    sections: desktopData.sections.map((s) => ({
      ...s,
      mobileLayout:
        (mobileData.sections || []).find((m) => m.index === s.index)
          ?.desktopLayout || null,
    })),
    interactiveBehavior: [
      'lazy-loaded images on scroll',
      'possible load-more on blog listings',
      'Wix booking widgets on service pages',
    ],
    wixDataNotes: desktopData.wixData,
    newSiteComponent: entry.newSiteRoute
      ? `app route ${entry.newSiteRoute}`
      : null,
    missingInNewSite: entry.newSiteRoute
      ? 'Compare via clone-gap-analysis'
      : 'No corresponding new-site route mapped',
    captureMeta: desktopMeta,
  };

  writeJson(path.join(pageDir, 'page-spec.json'), pageSpec);
  writeText(
    path.join(pageDir, 'content.md'),
    buildContentMd(entry, desktopData)
  );
  writeJson(path.join(pageDir, 'capture-meta.json'), desktopMeta);

  // Content quality checks
  const meaningful =
    (desktopData.fullText || '').replace(/\s+/g, ' ').trim().length >= 80 &&
    !(
      rendered.length < 5000 &&
      /window\.warmupData|wix-thunderbolt/i.test(rendered) &&
      !desktopData.fullText
    );

  if (!raw.ok || raw.status >= 400) {
    entry.captureStatus = 'failed';
    errors.push({
      route: entry.originalRoute,
      stage: 'raw',
      status: raw.status,
    });
  } else if (gotoError) {
    entry.captureStatus = 'partial';
    errors.push({
      route: entry.originalRoute,
      stage: 'goto',
      error: gotoError,
    });
  } else if (!meaningful) {
    entry.captureStatus = 'partial-shell';
    errors.push({
      route: entry.originalRoute,
      stage: 'rendered-content',
      error: 'Rendered HTML may lack meaningful visible text',
    });
  } else {
    entry.captureStatus = 'captured';
  }

  await page.close();
  return entry;
}

function consolidateDesign(samples) {
  const fonts = new Set();
  const colors = new Set();
  const radii = new Set();
  for (const s of samples) {
    const d = s.desktop || {};
    if (d.body?.fontFamily) fonts.add(d.body.fontFamily);
    if (d.h1?.fontFamily) fonts.add(d.h1.fontFamily);
    if (d.body?.color) colors.add(d.body.color);
    if (d.h1?.color) colors.add(d.h1.color);
    if (d.button?.backgroundColor) colors.add(d.button.backgroundColor);
    if (d.button?.borderRadius) radii.add(d.button.borderRadius);
  }
  return {
    generatedAt: CAPTURE_DATE,
    sampledPages: samples.length,
    fonts: [...fonts],
    colors: [...colors].slice(0, 80),
    borderRadii: [...radii],
    breakpoints: {
      desktopCaptureWidth: 1440,
      mobileCaptureWidth: 390,
    },
    notes: [
      'Tokens extracted from computed styles on captured pages.',
      'Prefer these over dumping full Wix runtime CSS.',
      'Per-page detail lives in pages/*/page-spec.json section desktopLayout.',
    ],
    perPage: samples,
  };
}

function buildGapAnalysis(inventory) {
  const publicAppRoutes = [
    '/',
    '/pracownia',
    '/dla-dzieci',
    '/dla-doroslych',
    '/grupy-i-firmy',
    '/galeria',
    '/kontakt',
    '/blog',
    '/warsztaty',
  ];

  const rows = [];
  for (const page of inventory.pages.filter(
    (p) => p.captureStatus !== 'excluded'
  )) {
    const exists = Boolean(
      page.newSiteRoute &&
      (publicAppRoutes.includes(page.newSiteRoute) ||
        page.newSiteRoute.startsWith('/blog/') ||
        page.newSiteRoute.startsWith('/warsztaty/'))
    );
    const gaps = [];
    if (!page.newSiteRoute) {
      gaps.push('No mapped new-site route');
    } else if (
      !exists &&
      !page.newSiteRoute.startsWith('/blog/') &&
      !page.newSiteRoute.startsWith('/warsztaty/')
    ) {
      gaps.push(
        `Mapped route ${page.newSiteRoute} may not exist as a dedicated page`
      );
    }

    // Heuristic content gaps from known rewrites
    if (
      [
        '/onas',
        '/dladzieci',
        '/dladoroslych',
        '/dlafirm',
        '/glinadowina',
        '/urodziny',
        '/panienskie',
      ].includes(page.originalRoute)
    ) {
      gaps.push(
        'Original marketing page likely condensed or rewritten on new site — verify section-by-section against page-spec and screenshots'
      );
    }
    if (page.originalRoute === '/galeria') {
      gaps.push(
        'New /galeria may consolidate images from many original contextual pages'
      );
    }
    if (page.pageType === 'blog-post') {
      gaps.push(
        'Confirm Polish body text, hero image, and category placement match original post'
      );
    }
    if (
      page.pageType === 'service-page' ||
      page.pageType === 'booking-calendar'
    ) {
      gaps.push(
        'Booking widget UX and schedule/pricing blocks must be reimplemented without Wix runtime'
      );
    }

    rows.push({
      originalRoute: page.originalRoute,
      originalUrl: page.canonicalUrl,
      newRoute: page.newSiteRoute,
      newRouteExists: Boolean(page.newSiteRoute),
      missingText:
        'See content.md vs new implementation (manual review required)',
      missingSections: gaps.length ? gaps : ['Pending implementation review'],
      incorrectSectionOrder: 'Review against page-spec.json section order',
      missingImages: 'Cross-check image-placement.json for this route',
      incorrectImagePlacement:
        'Images must stay in original section context — not only /galeria',
      incorrectImages: null,
      missingFormsOrCtas:
        page.pageType === 'contact' || page.pageType === 'webinar'
          ? 'Verify forms/CTAs'
          : null,
      layoutDifferences: 'Compare desktop/mobile screenshots to new site',
      desktopDifferences: rel(
        path.join(
          ROOT,
          'screenshots',
          'desktop',
          `${page.safeRoute.replace(/\//g, '__')}.png`
        )
      ),
      mobileDifferences: rel(
        path.join(
          ROOT,
          'screenshots',
          'mobile',
          `${page.safeRoute.replace(/\//g, '__')}.png`
        )
      ),
      missingInteractions:
        page.pageType.includes('booking') ||
        page.pageType === 'booking-calendar'
          ? 'Wix booking calendar'
          : null,
      consolidatedIntoGaleriaRisk: [
        '/vouchery',
        '/gift-card',
        '/courses',
        '/onas',
        '/galeria',
      ].includes(page.originalRoute),
      requiredImplementationWork: gaps,
      confidence:
        page.captureStatus === 'captured'
          ? 'high-for-reference'
          : 'medium-partial-capture',
      captureStatus: page.captureStatus,
    });
  }

  const md = [];
  md.push('# Original → New site clone gap analysis');
  md.push('');
  md.push(`Generated: ${CAPTURE_DATE}`);
  md.push('');
  md.push(
    'This analysis is based on the reference capture and route mapping. It does not modify the Next.js app.'
  );
  md.push('');
  for (const row of rows) {
    md.push(`## ${row.originalRoute}`);
    md.push('');
    md.push(`- New route: ${row.newRoute || '(none)'}`);
    md.push(`- Capture status: ${row.captureStatus}`);
    md.push(
      `- Consolidated-into-galeria risk: ${row.consolidatedIntoGaleriaRisk}`
    );
    md.push('- Required work:');
    for (const g of row.requiredImplementationWork) md.push(`  - ${g}`);
    md.push('');
  }

  return {
    json: { generatedAt: CAPTURE_DATE, routes: rows },
    md: md.join('\n'),
  };
}

function writeReadme(inventory) {
  const included = inventory.pages.filter(
    (p) => p.captureStatus !== 'excluded'
  );
  const excluded = inventory.pages.filter(
    (p) => p.captureStatus === 'excluded'
  );
  const lines = [];
  lines.push('# Original Ceramika Nero site — reference archive');
  lines.push('');
  lines.push(
    'This directory is an **authoritative visual/content reference** for rebuilding each page faithfully in the Next.js application.'
  );
  lines.push('');
  lines.push('**Do not** serve `raw.html` / `rendered.html` in production.');
  lines.push(
    '**Do not** load Wix runtime, trackers, or hotlinked `wixstatic` assets from the finished app.'
  );
  lines.push('');
  lines.push('## Source');
  lines.push('');
  lines.push(`- Original URL: ${ORIGIN}/`);
  lines.push(`- Capture date: ${inventory.generatedAt}`);
  lines.push(`- Genuine included pages: ${included.length}`);
  lines.push(`- Excluded routes: ${excluded.length}`);
  lines.push('');
  lines.push('## How capture was created');
  lines.push('');
  lines.push(
    '1. Rediscovered URLs from robots.txt, sitemaps, seeds, prior crawl, and Playwright link crawl (nav/footer/content + load-more).'
  );
  lines.push(
    '2. Classified genuine Ceramika pages vs Wix template/system routes.'
  );
  lines.push(
    '3. Saved raw HTTP HTML and Playwright-rendered DOM after scroll/lazy-load/accordion/load-more.'
  );
  lines.push('4. Extracted `page-spec.json` + verbatim `content.md`.');
  lines.push('5. Full-page desktop (1440) and mobile (390) screenshots.');
  lines.push(
    '6. Mapped every visible image occurrence to local `/images/wix-migrated/*` when possible.'
  );
  lines.push('7. Extracted computed design tokens into `design-system.json`.');
  lines.push(
    '8. Compared routes to the current Next.js app in `clone-gap-analysis.*`.'
  );
  lines.push('');
  lines.push('## Directory structure');
  lines.push('');
  lines.push('```');
  lines.push('reference/original-site/');
  lines.push('  page-inventory.json');
  lines.push('  image-placement.json');
  lines.push('  design-system.json');
  lines.push('  design-notes.md');
  lines.push('  clone-gap-analysis.json');
  lines.push('  clone-gap-analysis.md');
  lines.push('  asset-manifest.json');
  lines.push('  README.md');
  lines.push('  pages/<safe-route>/raw.html');
  lines.push('  pages/<safe-route>/rendered.html');
  lines.push('  pages/<safe-route>/page-spec.json');
  lines.push('  pages/<safe-route>/content.md');
  lines.push('  screenshots/desktop/*.png');
  lines.push('  screenshots/mobile/*.png');
  lines.push('  assets/');
  lines.push('  meta/');
  lines.push('```');
  lines.push('');
  lines.push('## raw.html vs rendered.html');
  lines.push('');
  lines.push(
    '- `raw.html` — initial HTTP response (often a Wix shell + embedded JSON).'
  );
  lines.push(
    '- `rendered.html` — DOM after Wix client render, scrolling, and lazy-load. **Prefer this + page-spec + screenshots for reconstruction.**'
  );
  lines.push('');
  lines.push('## How Cursor should use this archive');
  lines.push('');
  lines.push('For each route:');
  lines.push('1. Read `content.md` for verbatim Polish copy order.');
  lines.push(
    '2. Read `page-spec.json` for section sequence, CTAs, and image placement.'
  );
  lines.push(
    '3. Open desktop/mobile screenshots for layout, crop, and hierarchy.'
  );
  lines.push(
    '4. Resolve images via `image-placement.json` → local migrated paths.'
  );
  lines.push('5. Check `clone-gap-analysis.md` for known gaps.');
  lines.push('6. Implement cleanly in Next.js — do not paste Wix markup.');
  lines.push('');
  lines.push('## Excluded pages');
  lines.push('');
  for (const e of excluded) {
    lines.push(`- \`${e.originalRoute}\` — ${e.exclusionReason}`);
  }
  lines.push('');
  lines.push('## Known limitations');
  lines.push('');
  lines.push(
    '- Wix booking calendars and some third-party widgets may remain interaction-dependent.'
  );
  lines.push(
    '- Carousel slides not selected may need section-level follow-up screenshots.'
  );
  lines.push('- Computed styles are samples, not a full CSS dump.');
  lines.push(
    '- Network-idle is best-effort; Wix analytics may keep connections open.'
  );
  lines.push('');
  lines.push('## Rerun safely');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/capture-original-site.js');
  lines.push('node scripts/validate-original-site-reference.js');
  lines.push('```');
  lines.push('');
  lines.push(
    'Optional: `--limit=3`, `--only=/onas`, `--skip-screenshots`, `--discover-only`.'
  );
  lines.push('');
  lines.push('## Page index');
  lines.push('');
  lines.push(
    '| Route | Title | Raw | Rendered | Content | Spec | Desktop | Mobile | New route | Status |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const p of included) {
    lines.push(
      `| ${p.originalRoute} | ${(p.pageTitle || '').replace(/\|/g, '/')} | [raw](${p.rawHtmlPath}) | [rendered](${p.renderedHtmlPath}) | [md](${p.extractedContentPath}) | [spec](${p.pageSpecPath}) | [desk](${p.desktopScreenshotPath}) | [mob](${p.mobileScreenshotPath}) | ${p.newSiteRoute || '—'} | ${p.captureStatus} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function downloadExtraAssets(mediaById) {
  const assetManifest = {
    generatedAt: CAPTURE_DATE,
    assets: [],
    notes: [
      'Primary images already live under public/images/wix-migrated/.',
      'This manifest records non-duplicated reference assets and pointers.',
    ],
  };

  ensureDir(path.join(ROOT, 'assets'));

  // Point at existing migrated inventory rather than duplicating binaries
  for (const [id, localPath] of Object.entries(mediaById)) {
    assetManifest.assets.push({
      type: 'image',
      mediaId: id,
      localPath,
      storedInReference: false,
      provenance: 'public/images/wix-migrated (prior migration)',
    });
  }

  // Attempt favicon / apple-touch
  const extras = [
    { url: `${ORIGIN}/favicon.ico`, name: 'favicon.ico' },
    {
      url: 'https://static.wixstatic.com/media/11062b_f5420b566fbe45bf931871861e8cbf46~mv2.jpeg',
      name: 'probe-skip-if-migrated',
    },
  ];
  for (const extra of extras) {
    if (extra.name.includes('probe')) continue;
    try {
      const res = await fetch(extra.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const dest = path.join(ROOT, 'assets', extra.name);
      fs.writeFileSync(dest, buf);
      assetManifest.assets.push({
        type: 'icon',
        url: extra.url,
        localPath: rel(dest),
        storedInReference: true,
        provenance: 'downloaded during reference capture',
      });
    } catch {
      /* optional */
    }
  }

  writeJson(path.join(ROOT, 'asset-manifest.json'), assetManifest);
  return assetManifest;
}

async function main() {
  ensureDir(ROOT);
  let inventory;
  if (SKIP_DISCOVER) {
    console.log('Reusing existing page-inventory.json (--skip-discover)');
    inventory = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'page-inventory.json'), 'utf8')
    );
  } else {
    console.log('Discovering pages…');
    inventory = await discoverPages();
  }
  console.log(
    `Discovered ${inventory.totals.discovered} URLs (${inventory.totals.included} included, ${inventory.totals.excluded} excluded)`
  );

  if (DISCOVER_ONLY) {
    console.log('Discover-only mode; stopping.');
    return;
  }

  let targets = inventory.pages.filter((p) => p.captureStatus !== 'excluded');
  if (RESUME) {
    targets = targets.filter((p) => {
      const rendered = path.join(ROOT, 'pages', p.safeRoute, 'rendered.html');
      const spec = path.join(ROOT, 'pages', p.safeRoute, 'page-spec.json');
      const content = path.join(ROOT, 'pages', p.safeRoute, 'content.md');
      const desk = path.join(
        ROOT,
        'screenshots',
        'desktop',
        `${p.safeRoute.replace(/\//g, '__')}.png`
      );
      return !(
        fs.existsSync(rendered) &&
        fs.existsSync(spec) &&
        fs.existsSync(content) &&
        (SKIP_SHOTS || fs.existsSync(desk)) &&
        fs.statSync(rendered).size > 1000
      );
    });
    console.log(`Resume mode: ${targets.length} pages remaining`);
  }
  if (ONLY) {
    const onlyNorm = normalizeUrl(
      ONLY.startsWith('http') ? ONLY : ORIGIN + ONLY
    );
    targets = targets.filter(
      (p) =>
        p.originalRoute === ONLY ||
        p.canonicalUrl === onlyNorm?.canonicalHref ||
        p.safeRoute === ONLY.replace(/^\//, '')
    );
  }
  if (LIMIT > 0) targets = targets.slice(0, LIMIT);

  const mediaById = loadMediaLookup();
  const imagePlacements = [];
  const designSamples = [];
  const errors = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 CeramikaNeroReferenceCapture/1.0',
    locale: 'pl-PL',
    viewport: { width: 1440, height: 900 },
  });

  let i = 0;
  for (const entry of targets) {
    i += 1;
    console.log(`[${i}/${targets.length}] Capturing ${entry.originalRoute} …`);
    try {
      await capturePage(
        context,
        entry,
        mediaById,
        imagePlacements,
        designSamples,
        errors
      );
    } catch (err) {
      entry.captureStatus = 'failed';
      errors.push({
        route: entry.originalRoute,
        stage: 'capture',
        error: String(err.message || err),
      });
      console.error('  FAILED', err.message || err);
    }
    // Update inventory entry in place and persist progress
    const inv = inventory.pages.find(
      (p) => p.canonicalUrl === entry.canonicalUrl
    );
    if (inv) Object.assign(inv, entry);
    writeJson(path.join(ROOT, 'page-inventory.json'), inventory);
    writeJson(path.join(ROOT, 'meta', 'capture-progress.json'), {
      updatedAt: new Date().toISOString(),
      completed: i,
      total: targets.length,
      lastRoute: entry.originalRoute,
      status: entry.captureStatus,
    });
  }

  await browser.close();

  writeJson(path.join(ROOT, 'image-placement.json'), {
    generatedAt: CAPTURE_DATE,
    occurrenceCount: imagePlacements.length,
    unresolvedCount: imagePlacements.filter((p) => !p.resolvedLocally).length,
    placements: imagePlacements,
  });

  const design = consolidateDesign(designSamples);
  writeJson(path.join(ROOT, 'design-system.json'), design);
  writeText(
    path.join(ROOT, 'design-notes.md'),
    [
      '# Design notes (from computed styles)',
      '',
      `Captured: ${CAPTURE_DATE}`,
      '',
      '## Fonts observed',
      ...design.fonts.map((f) => `- ${f}`),
      '',
      '## Notes for reconstruction',
      '',
      '- Match section order and hierarchy from screenshots + page-spec, not Wix class names.',
      '- Prefer full-bleed photography where the original uses edge-to-edge media.',
      '- Keep Polish copy verbatim from content.md.',
      '- Button/CTA styles should be sampled from design-system.json and desktop screenshots.',
      '- Header/footer should remain consistent across marketing pages unless a page-spec notes a variant.',
      '',
    ].join('\n')
  );

  await downloadExtraAssets(mediaById);

  const gap = buildGapAnalysis(inventory);
  writeJson(path.join(ROOT, 'clone-gap-analysis.json'), gap.json);
  writeText(path.join(ROOT, 'clone-gap-analysis.md'), gap.md);

  writeJson(path.join(ROOT, 'page-inventory.json'), inventory);
  writeJson(path.join(ROOT, 'meta', 'capture-errors.json'), errors);
  writeText(path.join(ROOT, 'README.md'), writeReadme(inventory));

  console.log('Done.');
  console.log(
    JSON.stringify(
      {
        included: inventory.totals.included,
        captured: inventory.pages.filter((p) => p.captureStatus === 'captured')
          .length,
        partial: inventory.pages.filter((p) =>
          String(p.captureStatus).startsWith('partial')
        ).length,
        failed: inventory.pages.filter((p) => p.captureStatus === 'failed')
          .length,
        imagePlacements: imagePlacements.length,
        errors: errors.length,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
