const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { imageSize } = require('image-size');

const INVENTORY_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'inventory.json'
);
const OUTPUT_DIR = path.join(
  __dirname,
  '..',
  'public',
  'images',
  'wix-migrated'
);
const MAPPING_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'image-mapping.json'
);
const SUMMARY_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'download-summary.json'
);
const COMPLETE_INVENTORY_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'complete-inventory.json'
);

function parseWixMediaUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('wixstatic.com')) return null;

    // Standard: /media/{id}~mv2.{ext}
    let match = u.pathname.match(
      /\/media\/([a-f0-9]+_[a-f0-9]+)(?:~mv2)?\.([a-z0-9]+)/i
    );
    if (match) {
      return {
        id: match[1],
        ext: match[2].toLowerCase(),
        originalUrl: `https://static.wixstatic.com/media/${match[1]}~mv2.${match[2].toLowerCase()}`,
      };
    }

    // Without extension in path segment before transform
    match = u.pathname.match(/\/media\/([a-f0-9]+_[a-f0-9]+)(?:~mv2)?/i);
    if (match) {
      const extMatch =
        url.match(/~mv2\.([a-z0-9]+)/i) ||
        url.match(/\.([a-z0-9]+)(?:\/|$|\?)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      return {
        id: match[1],
        ext,
        originalUrl: `https://static.wixstatic.com/media/${match[1]}~mv2.${ext}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function parseDimensions(url) {
  const wMatch = url.match(/[/_]w_(\d+)/);
  const hMatch = url.match(/[/_]h_(\d+)/);
  return {
    width: wMatch ? parseInt(wMatch[1], 10) : 0,
    height: hMatch ? parseInt(hMatch[1], 10) : 0,
  };
}

function area(url) {
  const { width, height } = parseDimensions(url);
  return width * height;
}

function classifyUsage(references) {
  const contexts = [...new Set(references.map((r) => r.context))];
  const pages = [...new Set(references.map((r) => r.page))];
  const alts = references.map((r) => (r.alt || '').toLowerCase());

  if (contexts.some((c) => c.startsWith('meta-og'))) return 'social';
  if (contexts.some((c) => c === 'icon')) return 'branding';
  if (alts.some((a) => /facebook|instagram|logo|partner/i.test(a)))
    return 'branding';
  if (pages.some((p) => /\/galeria/.test(p))) return 'content';
  if (pages.some((p) => /\/service-page\/|\/product-page\//.test(p)))
    return 'content';
  if (contexts.some((c) => /background/.test(c))) return 'decorative';
  return 'content';
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

  const foundImages = inventory.inventory.filter((i) => i.status === 'found');
  const unavailableImages = inventory.inventory.filter(
    (i) => i.status === 'unavailable'
  );
  const byMediaId = new Map();
  const nonWixFound = [];

  for (const item of foundImages) {
    const parsed = parseWixMediaUrl(item.url);
    if (!parsed) {
      nonWixFound.push(item);
      continue;
    }
    const { id, ext, originalUrl } = parsed;
    if (!byMediaId.has(id)) {
      byMediaId.set(id, {
        ext,
        originalUrl,
        urls: [],
        references: [],
      });
    }
    const entry = byMediaId.get(id);
    entry.urls.push(item.url);
    entry.references.push(...item.references);
    // Prefer larger variants only as fallback if original fails
    if (area(item.url) > area(entry.bestFallback || '')) {
      entry.bestFallback = item.url;
    }
  }

  const mapping = [];
  const errors = [];
  let downloaded = 0;
  let replaced = 0;
  let skipped = 0;

  for (const [id, entry] of byMediaId.entries()) {
    const filename = `${id}.${entry.ext}`;
    const destPath = path.join(OUTPUT_DIR, filename);
    let buffer = null;
    let sourceUrl = entry.originalUrl;
    let usedFallback = false;

    try {
      buffer = await downloadImage(entry.originalUrl);
    } catch (err) {
      // Fall back to largest CDN variant if original path fails
      if (entry.bestFallback) {
        try {
          buffer = await downloadImage(entry.bestFallback);
          sourceUrl = entry.bestFallback;
          usedFallback = true;
        } catch (err2) {
          errors.push({
            id,
            url: entry.originalUrl,
            fallbackUrl: entry.bestFallback,
            error: `${err.message}; fallback: ${err2.message}`,
          });
          continue;
        }
      } else {
        errors.push({ id, url: entry.originalUrl, error: err.message });
        continue;
      }
    }

    const exists = fs.existsSync(destPath);
    let shouldWrite = true;
    if (exists) {
      const existing = fs.readFileSync(destPath);
      if (existing.length >= buffer.length && existing.equals(buffer)) {
        shouldWrite = false;
        skipped++;
      } else if (existing.length >= buffer.length) {
        // Keep larger existing file
        buffer = existing;
        shouldWrite = false;
        skipped++;
      } else {
        replaced++;
      }
    } else {
      downloaded++;
    }

    if (shouldWrite) {
      fs.writeFileSync(destPath, buffer);
    }

    let dimensions = { width: 0, height: 0 };
    try {
      dimensions = imageSize(buffer);
    } catch {
      // ignore
    }

    const uniquePages = [...new Set(entry.references.map((r) => r.page))];
    const contexts = [...new Set(entry.references.map((r) => r.context))];
    const alts = [
      ...new Set(entry.references.map((r) => r.alt).filter(Boolean)),
    ];

    mapping.push({
      id,
      originalUrl: sourceUrl,
      preferredOriginalUrl: entry.originalUrl,
      usedFallback,
      localPath: `/images/wix-migrated/${filename}`,
      absolutePath: destPath,
      filename,
      ext: entry.ext,
      dimensions,
      fileSizeBytes: buffer.length,
      sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
      pages: uniquePages,
      contexts,
      altTexts: alts,
      usageCategory: classifyUsage(entry.references),
      referenceCount: entry.references.length,
      allVariantUrls: [...new Set(entry.urls)],
    });
  }

  // Build complete inventory report
  const completeInventory = {
    generatedAt: new Date().toISOString(),
    originalSite: 'https://www.ceramikanero.com/',
    pagesDiscovered: inventory.pagesVisited,
    totals: {
      imageReferences: inventory.totalImageUrls,
      uniqueContentHashesInCrawl: inventory.uniqueFiles,
      uniqueWixMediaIds: byMediaId.size,
      downloadedOrPresent: mapping.length,
      nonWixFound: nonWixFound.length,
      unavailableReferences: unavailableImages.length,
      downloadErrors: errors.length,
    },
    notes: {
      unavailableExplanation:
        'Many unavailable URLs are malformed relative paths resolved against ceramikanero.com (e.g. /quality_auto/...) or truncated Wix transform URLs. Unique media IDs are still captured via other successful variants.',
      nonWixFound,
    },
    mapping,
    errors,
  };

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
  fs.writeFileSync(
    SUMMARY_PATH,
    JSON.stringify(
      {
        totalUniqueMediaIds: byMediaId.size,
        downloaded,
        replaced,
        skipped,
        errors: errors.length,
        errorDetails: errors,
        nonWixFound: nonWixFound.length,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    COMPLETE_INVENTORY_PATH,
    JSON.stringify(completeInventory, null, 2)
  );

  console.log(`Unique Wix media IDs: ${byMediaId.size}`);
  console.log(`Downloaded (new): ${downloaded}`);
  console.log(`Replaced with larger original: ${replaced}`);
  console.log(`Skipped (already optimal): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Mapping: ${MAPPING_PATH}`);
  console.log(`Complete inventory: ${COMPLETE_INVENTORY_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
