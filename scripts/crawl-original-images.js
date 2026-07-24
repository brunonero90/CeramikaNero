const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const START_URL = 'https://www.ceramikanero.com/';
const ORIGIN = new URL(START_URL).origin;
const OUTPUT_DIR = path.join(__dirname, '..', 'tmp', 'wix-crawl');
const INVENTORY_PATH = path.join(OUTPUT_DIR, 'inventory.json');

const MAX_PAGES = 200;
const VISITED = new Set();
const TO_VISIT = [START_URL];
const IMAGES = new Map(); // url -> { hashes: Set, references: [] }

function normalizeUrl(url, base) {
  try {
    if (!url) return null;
    const resolved = new URL(url, base).href;
    const u = new URL(resolved);
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

function isInternalPageUrl(url) {
  try {
    const u = new URL(url);
    if (u.origin !== ORIGIN && !u.hostname.endsWith('ceramikanero.com'))
      return false;
    const ext = path.extname(u.pathname).toLowerCase();
    if (ext && !['.html', '.htm', ''].includes(ext)) return false;
    return true;
  } catch {
    return false;
  }
}

function isImageUrl(url) {
  if (/^data:/i.test(url)) return false;
  return (
    /\.(png|jpe?g|gif|webp|svg|avif|ico|bmp|tiff?)(\?.*)?$/i.test(url) ||
    /static\.wixstatic\.com\/media\//.test(url) ||
    /wixmp\.com/.test(url) ||
    /images\.unsplash\.com/.test(url) ||
    /pexels\.com/.test(url) ||
    /s\.w\.org\//.test(url) ||
    /\/~mv2\//.test(url)
  );
}

async function scrollToBottom(page) {
  let lastHeight = 0;
  let unchanged = 0;
  while (unchanged < 3) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await page.waitForTimeout(500);
    if (height === lastHeight) {
      unchanged++;
    } else {
      unchanged = 0;
      lastHeight = height;
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function collectImages(page, pageUrl) {
  const results = await page.evaluate((origin) => {
    const images = [];

    function addImage(src, context, alt = '') {
      if (!src) return;
      images.push({ src: src.trim(), context, alt });
    }

    function addSrcset(srcset, context, alt = '') {
      if (!srcset) return;
      srcset.split(',').forEach((part) => {
        const [url, descriptor] = part.trim().split(/\s+/);
        addImage(url, `${context}-srcset`, alt);
      });
    }

    // img tags and srcset / data-src
    document.querySelectorAll('img').forEach((img) => {
      const alt = img.getAttribute('alt') || '';
      if (img.src) addImage(img.src, 'img', alt);
      addSrcset(img.srcset, 'img', alt);
      if (img.dataset.src) addImage(img.dataset.src, 'img-data-src', alt);
      if (img.dataset.srcset)
        addSrcset(img.dataset.srcset, 'img-data-srcset', alt);
      if (img.dataset.image) addImage(img.dataset.image, 'img-data-image', alt);
    });

    // wix-image custom elements
    document.querySelectorAll('wix-image').forEach((el) => {
      const alt = el.getAttribute('alt') || '';
      if (el.src) addImage(el.src, 'wix-image', alt);
      if (el.dataset.src) addImage(el.dataset.src, 'wix-image-data-src', alt);
    });

    // source srcset
    document.querySelectorAll('source').forEach((source) => {
      addSrcset(source.srcset, 'source', '');
      if (source.dataset.srcset)
        addSrcset(source.dataset.srcset, 'source-data', '');
    });

    // CSS background images from inline styles
    document.querySelectorAll('[style]').forEach((el) => {
      const style = el.getAttribute('style') || '';
      const matches = style.matchAll(
        /background-image:\s*url\((['"]?)([^'"]+)\1\)/gi
      );
      for (const m of matches) {
        addImage(m[2], 'inline-css-background', '');
      }
    });

    // data-bg and data-background
    document.querySelectorAll('[data-bg], [data-background]').forEach((el) => {
      if (el.dataset.bg) addImage(el.dataset.bg, 'data-bg', '');
      if (el.dataset.background)
        addImage(el.dataset.background, 'data-background', '');
    });

    // CSS variables and computed background images (limited)
    const allElements = document.querySelectorAll('*');
    allElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      const bg = computed.backgroundImage;
      if (bg && bg !== 'none' && bg.includes('url(')) {
        const matches = bg.matchAll(/url\((['"]?)([^'"]+)\1\)/gi);
        for (const m of matches) {
          addImage(m[2], 'computed-css-background', '');
        }
      }
    });

    // Open Graph and Twitter images
    document
      .querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')
      .forEach((meta) => {
        addImage(
          meta.getAttribute('content'),
          'meta-og',
          meta.getAttribute('alt') || ''
        );
      });

    // Favicons and icons
    document
      .querySelectorAll('link[rel*="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => {
        addImage(
          link.getAttribute('href'),
          'icon',
          link.getAttribute('rel') || ''
        );
      });

    // Logo / brand images in links
    document.querySelectorAll('a[href]').forEach((a) => {
      const logo = a.querySelector('img');
      if (logo && (a.href === origin || a.href === origin + '/')) {
        addImage(logo.src, 'logo', logo.getAttribute('alt') || '');
      }
    });

    return images;
  }, ORIGIN);

  return results;
}

async function collectStylesheetImages(page, pageUrl) {
  const cssUrls = await page.evaluate(() =>
    Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => link.href)
      .filter(Boolean)
  );
  const images = [];
  for (const cssUrl of cssUrls) {
    try {
      const response = await page.context().request.get(cssUrl);
      if (!response.ok()) continue;
      const css = await response.text();
      const matches = css.matchAll(/url\((['"]?)([^'"]+)\1\)/gi);
      for (const m of matches) {
        const url = m[2];
        if (/\.(png|jpe?g|gif|webp|svg|avif|ico)(\?.*)?$/i.test(url)) {
          images.push({ src: url, context: 'stylesheet', alt: '' });
        }
      }
    } catch {
      // ignore unreachable stylesheet
    }
  }
  return images;
}

async function collectLinks(page, pageUrl) {
  return await page.evaluate((origin) => {
    const links = [];
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      try {
        const url = new URL(href, origin).href;
        links.push(url);
      } catch {
        // ignore
      }
    });
    return links;
  }, ORIGIN);
}

async function hashImage(url) {
  try {
    const response = await fetch(url, { timeout: 30000 });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      hash: crypto.createHash('sha256').update(buffer).digest('hex'),
      size: buffer.length,
    };
  } catch {
    return null;
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  // Block heavy third-party resources to speed up crawling
  await page.route('**/*', (route) => {
    const url = route.request().url();
    const type = route.request().resourceType();
    if (['font', 'media', 'websocket'].includes(type)) {
      return route.abort();
    }
    if (
      type === 'script' &&
      /google-analytics|googletagmanager|facebook|doubleclick|hotjar|clarity/i.test(
        url
      )
    ) {
      return route.abort();
    }
    route.continue();
  });

  let pagesVisited = 0;
  while (TO_VISIT.length > 0 && pagesVisited < MAX_PAGES) {
    const rawUrl = TO_VISIT.shift();
    const normalized = normalizeUrl(rawUrl, START_URL);
    if (!normalized || VISITED.has(normalized)) continue;
    if (!isInternalPageUrl(normalized)) continue;

    VISITED.add(normalized);
    pagesVisited++;
    console.log(`[${pagesVisited}] Crawling ${normalized}`);

    try {
      await page.goto(normalized, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForTimeout(4000);
      await scrollToBottom(page);
      await page.waitForTimeout(2000);
    } catch (err) {
      console.error(`Failed to load ${normalized}: ${err.message}`);
      continue;
    }

    const images = await collectImages(page, normalized);
    const cssImages = await collectStylesheetImages(page, normalized);
    const allImages = [...images, ...cssImages];

    for (const img of allImages) {
      const absoluteUrl = normalizeUrl(img.src, normalized);
      if (!absoluteUrl) continue;
      if (!isImageUrl(absoluteUrl)) continue;
      if (!IMAGES.has(absoluteUrl)) {
        IMAGES.set(absoluteUrl, { references: [], hashes: new Set() });
      }
      IMAGES.get(absoluteUrl).references.push({
        page: normalized,
        context: img.context,
        alt: img.alt,
      });
    }

    const links = await collectLinks(page, normalized);
    for (const link of links) {
      const normalizedLink = normalizeUrl(link, START_URL);
      if (
        normalizedLink &&
        !VISITED.has(normalizedLink) &&
        isInternalPageUrl(normalizedLink)
      ) {
        TO_VISIT.push(normalizedLink);
      }
    }
  }

  await browser.close();

  // Hash images and deduplicate
  console.log(`Found ${IMAGES.size} unique image URLs. Hashing...`);
  const hashToUrls = new Map();
  const inventory = [];
  for (const [url, data] of IMAGES.entries()) {
    const hashInfo = await hashImage(url);
    if (!hashInfo) {
      inventory.push({
        url,
        status: 'unavailable',
        references: data.references,
      });
      continue;
    }
    const { hash, size } = hashInfo;
    data.hashes.add(hash);
    if (!hashToUrls.has(hash)) hashToUrls.set(hash, []);
    hashToUrls.get(hash).push(url);

    inventory.push({
      url,
      hash,
      size,
      status: 'found',
      references: data.references,
    });
  }

  // Mark duplicates
  for (const item of inventory) {
    if (item.status === 'found' && hashToUrls.get(item.hash).length > 1) {
      item.isDuplicate = true;
      item.duplicateOf = hashToUrls.get(item.hash).find((u) => u !== item.url);
    }
  }

  fs.writeFileSync(
    INVENTORY_PATH,
    JSON.stringify(
      {
        pagesVisited: Array.from(VISITED),
        totalImageUrls: IMAGES.size,
        unavailable: inventory.filter((i) => i.status === 'unavailable').length,
        duplicates: inventory.filter((i) => i.isDuplicate).length,
        uniqueFiles: new Set(
          inventory.filter((i) => i.status === 'found').map((i) => i.hash)
        ).size,
        inventory,
      },
      null,
      2
    )
  );

  console.log(`Inventory written to ${INVENTORY_PATH}`);
  console.log(`Pages visited: ${pagesVisited}`);
  console.log(`Unique image URLs: ${IMAGES.size}`);
  console.log(
    `Unique content hashes: ${new Set(inventory.filter((i) => i.status === 'found').map((i) => i.hash)).size}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
