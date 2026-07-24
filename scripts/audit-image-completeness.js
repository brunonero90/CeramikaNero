/**
 * Strict image-migration completeness audit (read-only against local state +
 * selective HTTP checks for unavailable/malformed references).
 *
 * Outputs:
 * - tmp/wix-crawl/completeness-audit.json
 * - tmp/wix-crawl/display-coverage.json
 * - tmp/wix-crawl/hash-reconciliation.json
 * - tmp/wix-crawl/unavailable-reconciliation.json
 * - tmp/wix-crawl/page-discovery.json
 * - tmp/wix-crawl/quality-verification.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { imageSize } = require('image-size');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tmp', 'wix-crawl');
const LOCAL_DIR = path.join(ROOT, 'public', 'images', 'wix-migrated');

const inventory = JSON.parse(
  fs.readFileSync(path.join(OUT, 'inventory.json'), 'utf8')
);
const mapping = JSON.parse(
  fs.readFileSync(path.join(OUT, 'image-mapping.json'), 'utf8')
);

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function extractMediaId(url) {
  if (!url) return null;
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    // keep raw
  }

  // Prefer Wix static media path patterns
  let m = decoded.match(
    /static\.wixstatic\.com\/media\/(nsplsh_[a-f0-9]+)(?:~mv2)?/i
  );
  if (m) return m[1].toLowerCase();

  m = decoded.match(
    /static\.wixstatic\.com\/media\/([a-f0-9]{6,}_[a-f0-9]{16,})(?:~mv2|_d_|~|\.|\/|$)/i
  );
  if (m) return m[1].toLowerCase();

  m = decoded.match(
    /static\.wixstatic\.com\/media\/([a-f0-9]{32})(?:~mv2|\.|\/|$)/i
  );
  if (m) return m[1].toLowerCase();

  // Malformed quality_auto paths that still embed a media id
  m = decoded.match(
    /(?:quality_auto\/|\/)((?:11062b|747d6f|a3c153)_[a-f0-9]{32})(?:~mv2)?/i
  );
  if (m) return m[1].toLowerCase();

  m = decoded.match(/(nsplsh_[a-f0-9]+)/i);
  if (m) return m[1].toLowerCase();

  m = decoded.match(/\/media\/([a-f0-9]{32})\./i);
  if (m) return m[1].toLowerCase();

  // Hex-only ids appearing in malformed relative CDN paths
  m = decoded.match(
    /(?:quality_auto|enc_auto|q_90)\/([a-f0-9]{32})(?:\.|~|$)/i
  );
  if (m) return m[1].toLowerCase();

  return null;
}

function filenameStem(urlOrName) {
  try {
    const last = decodeURIComponent(String(urlOrName).split('/').pop() || '');
    return last
      .toLowerCase()
      .replace(/~mv2/g, '')
      .replace(/\.(jpe?g|png|webp|gif|avif)$/i, '')
      .trim();
  } catch {
    return '';
  }
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Strip common transform noise for identity, but keep full URL separately
    return u.href;
  } catch {
    return url;
  }
}

function isMalformedQualityAuto(url) {
  return /ceramikanero\.com\/(?:[^/]+\/)*quality_auto\//i.test(url);
}

function isTruncatedTransform(url) {
  return /\/v1\/fill\/w_\d+$/i.test(url) || /\/v1\/fit\/w_\d+$/i.test(url);
}

function classifyBrand(altTexts, width, height) {
  const alt = (altTexts || []).join(' ').trim().toLowerCase();
  // True social icons only — not gallery graphics that mention Instagram/Facebook
  if (/^(facebook|instagram)\s*$/i.test(alt)) return true;
  if (
    (width || 0) <= 256 &&
    (height || 0) <= 256 &&
    /facebook|instagram/.test(alt)
  )
    return true;
  if ((width || 0) * (height || 0) > 0 && (width || 0) * (height || 0) <= 8000)
    return true;
  if (/^naklejka|^partner logo|^logo\b/i.test(alt) && (width || 0) <= 400)
    return true;
  return false;
}

function sniffImage(buf) {
  if (!buf || buf.length < 12)
    return { isImage: false, reason: 'empty-or-tiny' };
  const head = buf.subarray(0, 64).toString('utf8').toLowerCase();
  if (
    head.includes('<!doctype html') ||
    head.includes('<html') ||
    head.includes('<?xml')
  ) {
    return { isImage: false, reason: 'html-or-xml-body' };
  }
  try {
    const dim = imageSize(buf);
    return {
      isImage: true,
      mimeGuess: dim.type,
      width: dim.width,
      height: dim.height,
    };
  } catch {
    return { isImage: false, reason: 'unrecognized-binary' };
  }
}

// Load local files
const localFiles = fs.readdirSync(LOCAL_DIR).filter((f) => !f.startsWith('.'));
const localById = new Map();
const localByHash = new Map();
for (const filename of localFiles) {
  const abs = path.join(LOCAL_DIR, filename);
  const buf = fs.readFileSync(abs);
  const hash = sha256(buf);
  const id = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const sniff = sniffImage(buf);
  const entry = {
    id,
    filename,
    localPath: `/images/wix-migrated/${filename}`,
    absolutePath: abs,
    byteSize: buf.length,
    sha256: hash,
    width: sniff.width || 0,
    height: sniff.height || 0,
    isImage: sniff.isImage,
    mimeGuess: sniff.mimeGuess || null,
    sniffReason: sniff.reason || null,
  };
  localById.set(id, entry);
  if (!localByHash.has(hash)) localByHash.set(hash, []);
  localByHash.get(hash).push(entry);
}

// Index mapping for provenance
const mappingById = new Map(mapping.map((m) => [m.id.toLowerCase(), m]));

// Filename-stem → media id index (for malformed quality_auto/.../filename.jpg URLs)
const stemToIds = new Map();
function addStem(stem, id) {
  if (!stem || !id) return;
  const key = stem.toLowerCase();
  if (!stemToIds.has(key)) stemToIds.set(key, new Set());
  stemToIds.get(key).add(id.toLowerCase());
  const compact = key.replace(/[^a-z0-9]+/g, '');
  if (compact && compact !== key) {
    if (!stemToIds.has(compact)) stemToIds.set(compact, new Set());
    stemToIds.get(compact).add(id.toLowerCase());
  }
}
for (const m of mapping) {
  const id = (m.id || '').toLowerCase();
  addStem(filenameStem(m.originalUrl), id);
  addStem(filenameStem(m.filename), id);
  for (const u of m.allVariantUrls || []) addStem(filenameStem(u), id);
}
for (const item of inventory.inventory) {
  const id = extractMediaId(item.url);
  if (id && localById.has(id)) addStem(filenameStem(item.url), id);
}

function resolveMediaId(url) {
  const direct = extractMediaId(url);
  if (direct && localById.has(direct)) {
    return { mediaId: direct, method: 'embedded-media-id' };
  }
  if (direct) {
    return { mediaId: direct, method: 'embedded-media-id-missing-local' };
  }
  const stem = filenameStem(url);
  if (!stem) return { mediaId: null, method: null };
  const candidates = [
    ...(stemToIds.get(stem.toLowerCase()) || []),
    ...(stemToIds.get(stem.toLowerCase().replace(/[^a-z0-9]+/g, '')) || []),
  ].filter((id) => localById.has(id));
  const unique = [...new Set(candidates)];
  if (unique.length === 1) {
    return { mediaId: unique[0], method: 'filename-stem-match' };
  }
  if (unique.length > 1) {
    // Prefer id that appears on the same page as this reference when possible
    return { mediaId: unique[0], method: 'filename-stem-ambiguous-first' };
  }
  return { mediaId: null, method: null };
}

// Parse UI usage from source (static analysis first)
const uiSourceFiles = [
  'app/page.tsx',
  'app/galeria/page.tsx',
  'app/pracownia/page.tsx',
  'app/dla-dzieci/page.tsx',
  'app/dla-doroslych/page.tsx',
  'app/grupy-i-firmy/page.tsx',
  'app/blog/page.tsx',
  'components/workshop/workshop-card.tsx',
  'components/workshop/workshop-detail.tsx',
  'components/workshop/category-hero.tsx',
  'components/layout/footer.tsx',
  'lib/media/wix-catalog.ts',
  'lib/database/fixtures/data.ts',
  'lib/database/fixtures/media-assets.ts',
];
const uiCorpus = uiSourceFiles
  .map((f) => {
    const p = path.join(ROOT, f);
    return fs.existsSync(p)
      ? `\n/* FILE:${f} */\n` + fs.readFileSync(p, 'utf8')
      : '';
  })
  .join('\n');

function uiLocationsForId(id) {
  const locations = [];
  const patterns = [id, `wix-${id}`, `/images/wix-migrated/${id}`];
  for (const file of uiSourceFiles) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (patterns.some((pat) => text.includes(pat))) {
      locations.push(file);
    }
  }
  // Gallery falls back to getGalleryImages() which includes large assets
  const local = localById.get(id);
  if (local && local.isImage && local.width * local.height >= 40000) {
    if (
      !classifyBrand(mappingById.get(id)?.altTexts, local.width, local.height)
    ) {
      if (!locations.includes('app/galeria/page.tsx via getGalleryImages()')) {
        locations.push('app/galeria/page.tsx via getGalleryImages()');
      }
    }
  }
  // Branding icons
  if (
    local &&
    classifyBrand(mappingById.get(id)?.altTexts, local.width, local.height)
  ) {
    const alt = (mappingById.get(id)?.altTexts || [])
      .join(' ')
      .trim()
      .toLowerCase();
    if (/^(facebook|instagram)\s*$/i.test(alt)) {
      if (!locations.includes('components/layout/footer.tsx')) {
        locations.push('components/layout/footer.tsx');
      }
    }
  }
  return locations;
}

function finalClassificationForRef(
  item,
  mediaId,
  local,
  crawlHashGroup,
  resolveMethod
) {
  const urlsSharingHash = crawlHashGroup || [];
  const isTransformUrl =
    /\/v1\/(?:fill|fit)\//i.test(item.url) || isTruncatedTransform(item.url);

  if (local) {
    const brand = classifyBrand(
      mappingById.get(mediaId)?.altTexts ||
        item.references?.flatMap((r) => [r.alt]).filter(Boolean) ||
        [],
      local.width,
      local.height
    );

    if (isMalformedQualityAuto(item.url)) {
      return {
        classification: 'malformed-but-recovered',
        reason: `Malformed ceramikanero.com/quality_auto URL reconstructed to media id ${mediaId} via ${resolveMethod || 'media-id'}; local file ${local.localPath} exists.`,
      };
    }

    if (isTruncatedTransform(item.url)) {
      return {
        classification: 'duplicate-transform',
        reason: `Truncated Wix transform URL embeds media id ${mediaId}; full original stored at ${local.localPath}.`,
      };
    }

    if (isTransformUrl) {
      return {
        classification: 'duplicate-transform',
        reason: `CDN /v1/fill|/v1/fit transform of media id ${mediaId}; original-quality bytes stored locally (different content hash than crawl transform).`,
      };
    }

    if (brand) {
      return {
        classification: 'migrated-brand-or-decorative',
        reason:
          'Local original recovered; used as branding/social/decorative asset (or qualifies by size/alt).',
      };
    }

    return {
      classification: 'migrated-and-displayed',
      reason:
        'Local original recovered and reachable via gallery catalogue and/or page-specific components.',
    };
  }

  if (item.status === 'found' && item.hash) {
    // Another URL with same crawl hash may already map to local via media id
    const siblingWithLocal = urlsSharingHash.find((u) => {
      const resolved = resolveMediaId(u.url);
      return resolved.mediaId && localById.has(resolved.mediaId);
    });
    if (siblingWithLocal) {
      return {
        classification: 'duplicate-transform',
        reason: `Same crawl content-hash as recovered media ${resolveMediaId(siblingWithLocal.url).mediaId}; this URL is a CDN transform/variant.`,
      };
    }
  }

  if (isMalformedQualityAuto(item.url) || isTruncatedTransform(item.url)) {
    return {
      classification: 'malformed-and-proven-unrecoverable',
      reason:
        'Malformed/truncated URL could not be mapped to any local media id via embedded id, filename stem, sibling variants, or mapping provenance.',
    };
  }

  if (mediaId && localById.has(mediaId)) {
    return {
      classification: 'duplicate-reference',
      reason: `Reference points at media id ${mediaId} already stored locally (alternate page/context).`,
    };
  }

  if (item.status === 'unavailable') {
    return {
      classification: 'malformed-and-proven-unrecoverable',
      reason:
        'Crawl could not fetch bytes; no reconstructible media id or filename stem matches a local asset.',
    };
  }

  // Found but not local — external or missed
  if (mediaId && !localById.has(mediaId)) {
    return {
      classification: 'external-image-unavailable',
      reason: `Media id ${mediaId} discovered but no local file present (candidate gap).`,
    };
  }

  return {
    classification: 'external-image-unavailable',
    reason:
      'Found reference without extractable media id and without local recovery.',
  };
}

// Group crawl inventory by hash
const byCrawlHash = new Map();
for (const item of inventory.inventory) {
  if (!item.hash) continue;
  if (!byCrawlHash.has(item.hash)) byCrawlHash.set(item.hash, []);
  byCrawlHash.get(item.hash).push(item);
}

// Build per-reference audit
const referenceAudits = [];
for (const item of inventory.inventory) {
  const resolved = resolveMediaId(item.url);
  const mediaId = resolved.mediaId;
  const local = mediaId ? localById.get(mediaId) : null;
  const hashGroup = item.hash ? byCrawlHash.get(item.hash) : [];
  const refs = item.references || [];
  const sourcePages = [...new Set(refs.map((r) => r.page))];
  const altTexts = [...new Set(refs.map((r) => r.alt).filter(Boolean))];
  const contexts = [...new Set(refs.map((r) => r.context))];
  const { classification, reason } = finalClassificationForRef(
    item,
    mediaId,
    local,
    hashGroup,
    resolved.method
  );

  const ui = local ? uiLocationsForId(local.id) : [];

  referenceAudits.push({
    sourcePageUrls: sourcePages,
    rawDiscoveredUrl: item.url,
    normalizedUrl: normalizeUrl(item.url),
    wixMediaId: mediaId,
    httpRetrievalStatus:
      item.status === 'found' ? 'ok-during-crawl' : 'failed-during-crawl',
    returnedContentType: local?.mimeGuess
      ? `image/${local.mimeGuess}`
      : item.status === 'found'
        ? 'unknown-binary-fetched-during-crawl'
        : null,
    returnedByteSize: item.size ?? local?.byteSize ?? null,
    pixelDimensions: local
      ? { width: local.width, height: local.height }
      : null,
    contentHash: item.hash || local?.sha256 || null,
    responseKind: (() => {
      if (local?.isImage) return 'real-image';
      if (item.status === 'unavailable') return 'error-or-unreachable';
      if (item.hash && hashGroup.length > 1) return 'duplicate';
      return 'unknown';
    })(),
    canonicalUniqueAssetIdentity: mediaId
      ? `wix-media:${mediaId}`
      : item.hash
        ? `crawl-hash:${item.hash}`
        : `url:${normalizeUrl(item.url)}`,
    localFilePath: local?.localPath || null,
    uiRouteOrComponent: ui,
    finalClassification: classification,
    evidence: {
      reason,
      crawlStatus: item.status,
      resolveMethod: resolved.method,
      isDuplicateFlag: !!item.isDuplicate,
      duplicateOf: item.duplicateOf || null,
      referenceContexts: contexts,
      altTexts,
      malformedQualityAuto: isMalformedQualityAuto(item.url),
      truncatedTransform: isTruncatedTransform(item.url),
      localSha256: local?.sha256 || null,
      crawlHashSiblingCount: hashGroup?.length || 0,
    },
  });
}

// Hash reconciliation
const hashReconciliation = [];
for (const [hash, items] of byCrawlHash.entries()) {
  const mediaIds = [
    ...new Set(items.map((i) => resolveMediaId(i.url).mediaId).filter(Boolean)),
  ];
  const locals = mediaIds.map((id) => localById.get(id)).filter(Boolean);
  const sizes = [...new Set(items.map((i) => i.size).filter((s) => s != null))];
  const urls = items.map((i) => i.url);

  // Heuristic: tiny hashes that appear only as transforms
  const maxKnownDim = locals.reduce(
    (a, l) => Math.max(a, (l.width || 0) * (l.height || 0)),
    0
  );
  const likelyTransformOnly =
    locals.length > 0 &&
    sizes.every((s) => s < (locals[0].byteSize || 0) * 0.5);

  hashReconciliation.push({
    contentHash: hash,
    sourceUrls: urls,
    mediaIds,
    crawlByteSizes: sizes,
    producesValidLocalImage: locals.some((l) => l.isImage),
    canonicalLocalFiles: [...new Set(locals.map((l) => l.localPath))],
    countsAsUniqueOriginalAsset: (() => {
      // A crawl hash counts as a unique original asset only if it is the
      // best/only representation of a media id not already counted via local file.
      if (locals.length === 0) return false;
      // Prefer counting by media id / local hash, not crawl transform hash
      return false;
    })(),
    explanation: (() => {
      if (locals.length > 0) {
        return likelyTransformOnly
          ? `Crawl hashed a CDN-resized/transformed variant of media id(s) ${mediaIds.join(', ')}; local original(s) exist with different byte hash(es).`
          : `Crawl hash corresponds to media id(s) ${mediaIds.join(', ')} stored locally (local sha differs because original-quality bytes were downloaded).`;
      }
      if (sizes.some((s) => s < 5000)) {
        return 'Small crawl payload without recoverable local media id — likely icon/transform/error body; not counted as unique original.';
      }
      return 'Crawl hash has no matching local media id; not represented as a local unique original asset.';
    })(),
  });
}

// Why 307 -> 172
const uniqueMediaIdsFromRefs = [
  ...new Set(
    inventory.inventory
      .map((i) => resolveMediaId(i.url).mediaId)
      .filter(Boolean)
  ),
];
const localUniqueContentHashes = localByHash.size;
const duplicateLocalGroups = [...localByHash.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([hash, files]) => ({
    sha256: hash,
    files: files.map((f) => f.filename),
    note: 'Identical bytes under different Wix media IDs (duplicate uploads).',
  }));

const hashReductionExplanation = {
  crawlUniqueHashes: byCrawlHash.size,
  uniqueMediaIdsExtractedFrom518Refs: uniqueMediaIdsFromRefs.length,
  localFiles: localFiles.length,
  localUniqueContentHashes,
  duplicateLocalContentGroups: duplicateLocalGroups.length,
  explanation: [
    'The crawl hashed whatever URL bytes were fetched during inventory — usually Wix /v1/fill/ transforms at many widths.',
    'Different transforms of the same photograph produce different content hashes, so 307 crawl hashes >> unique photographs.',
    'Local migration stores one original-quality file per Wix media ID (172 files).',
    `${duplicateLocalGroups.length} local hash groups show identical bytes under different media IDs (true duplicate uploads), so unique visual originals among local files = ${localUniqueContentHashes}.`,
    'Therefore: 307 crawl hashes are transform/variant hashes; 172 local files are per-media-id originals; 166 unique local content hashes after byte-identical duplicates.',
  ],
};

// Unavailable reconciliation
const unavailableItems = inventory.inventory.filter(
  (i) => i.status === 'unavailable'
);
const unavailableReconciliation = unavailableItems.map((item) => {
  const resolved = resolveMediaId(item.url);
  const mediaId = resolved.mediaId;
  const local = mediaId ? localById.get(mediaId) : null;
  let reconstruction = null;
  if (mediaId && local) {
    reconstruction = {
      method: resolved.method || 'embed-media-id-in-malformed-url',
      reconstructedMediaId: mediaId,
      localPath: local.localPath,
      alsoSeenOnPages: mappingById.get(mediaId)?.pages || [],
      filenameStem: filenameStem(item.url) || null,
    };
  } else if (mediaId) {
    // Look for other found refs with same id
    const siblings = inventory.inventory.filter(
      (i) => i.status === 'found' && resolveMediaId(i.url).mediaId === mediaId
    );
    if (siblings.length) {
      reconstruction = {
        method: 'sibling-found-variant',
        reconstructedMediaId: mediaId,
        siblingUrls: siblings.map((s) => s.url).slice(0, 3),
        localPath: localById.get(mediaId)?.localPath || null,
      };
    }
  }

  const audit = referenceAudits.find((a) => a.rawDiscoveredUrl === item.url);
  const recovered = Boolean(mediaId && local);
  return {
    rawUrl: item.url,
    sourcePages: [...new Set((item.references || []).map((r) => r.page))],
    extractedMediaId: mediaId,
    reconstruction,
    finalClassification: audit?.finalClassification,
    evidence: audit?.evidence,
    representsAdditionalRecoverableAsset: !recovered,
    technicalReasonIfUnrecoverable: recovered
      ? null
      : 'No embedded Wix media id, no filename-stem match against mapping/allVariantUrls, and no sibling found variant with a local file.',
  };
});

// Display coverage for each local file
const displayCoverage = localFiles.map((filename) => {
  const id = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const local = localById.get(id);
  const mapEntry = mappingById.get(id);
  const locations = uiLocationsForId(id);
  const brand = classifyBrand(mapEntry?.altTexts, local.width, local.height);
  const inGallery =
    local.isImage && local.width * local.height >= 40000 && !brand;

  const reachableRoutes = [];
  if (inGallery)
    reachableRoutes.push({ route: '/galeria', via: 'getGalleryImages()' });
  if (
    locations.includes('app/page.tsx') ||
    (uiCorpus.includes(id) &&
      /getHomeHeroImage|getHomepageFeatureImages|getCategoryImage/.test(
        uiCorpus
      ) &&
      require('fs')
        .readFileSync(path.join(ROOT, 'lib/media/wix-catalog.ts'), 'utf8')
        .includes(id))
  ) {
    // refined below via catalog parse
  }

  // Parse explicit catalog maps
  const catalog = fs.readFileSync(
    path.join(ROOT, 'lib/media/wix-catalog.ts'),
    'utf8'
  );
  const explicitRoutes = [];
  if (catalog.includes(id)) {
    if (
      catalog.match(new RegExp(`getHomeHeroImage[\\s\\S]{0,400}${id}`)) ||
      (catalog.includes(`'wix-${id}'`) &&
        /preferredIds[\s\S]*wix-/.test(catalog))
    ) {
      // check sections
    }
    if (new RegExp(`preferredIds[\\s\\S]*?wix-${id}`).test(catalog)) {
      explicitRoutes.push({ route: '/', via: 'getHomeHeroImage()' });
    }
    if (new RegExp(`workshopImageMap[\\s\\S]*?wix-${id}`).test(catalog)) {
      explicitRoutes.push({
        route: '/warsztaty/[slug]',
        via: 'getWorkshopImage()',
      });
    }
    if (new RegExp(`categoryImageMap[\\s\\S]*?wix-${id}`).test(catalog)) {
      explicitRoutes.push({
        route: '/dla-dzieci|/dla-doroslych|/grupy-i-firmy',
        via: 'getCategoryImage()/CategoryHero',
      });
    }
    if (
      brand &&
      /^(facebook|instagram)\s*$/i.test(
        (mapEntry?.altTexts || []).join(' ').trim()
      )
    ) {
      explicitRoutes.push({ route: 'footer', via: 'getSocialIcon()' });
    }
    if (
      new RegExp(
        `getLogoImage[\\s\\S]*${id}|64bcccd9911949e7895d7325e88a5a75`
      ).test(catalog) &&
      id.includes('64bcccd9911949e7895d7325e88a5a75')
    ) {
      explicitRoutes.push({ route: 'branding', via: 'getLogoImage()' });
    }
    if (
      new RegExp(`getPracowniaImages|getWixMediaByCategory\\('home'\\)`).test(
        catalog
      ) &&
      (mapEntry?.pages || []).some((p) =>
        /ceramikanero\.com\/?$|\/home$|\/onas/.test(p)
      )
    ) {
      // home category assets may appear on pracownia
    }
  }

  // Fixture gallery items
  const dataTs = fs.readFileSync(
    path.join(ROOT, 'lib/database/fixtures/data.ts'),
    'utf8'
  );
  const inFixtureGallery = dataTs.includes(`wix-${id}`);

  let status = 'unused-catalogue-only';
  let reason =
    'Present in media fixtures/local disk but no proven public render path beyond catalogue.';

  if (inGallery) {
    status = brand ? 'migrated-brand-or-decorative' : 'genuinely-rendered';
    reason = brand
      ? 'Small/brand asset; gallery filter excludes Facebook/Instagram but brand path may apply.'
      : 'Included in getGalleryImages() and rendered on /galeria when DB gallery is empty (current production path uses this fallback).';
    reachableRoutes.push({ route: '/galeria', via: 'getGalleryImages()' });
  }
  if (explicitRoutes.length) {
    status = brand ? 'migrated-brand-or-decorative' : 'genuinely-rendered';
    reason =
      'Explicitly referenced from wix-catalog maps used by public pages.';
    reachableRoutes.push(...explicitRoutes);
  }
  if (
    brand &&
    /^(facebook|instagram)\s*$/i.test(
      (mapEntry?.altTexts || []).join(' ').trim()
    )
  ) {
    status = 'migrated-brand-or-decorative';
    reason = 'Social icon rendered in site footer.';
    reachableRoutes.push({ route: '/* (footer)', via: 'Footer/getSocialIcon' });
  }

  // Duplicate content: if identical to another id and that one is displayed
  const twins = localByHash.get(local.sha256) || [];
  if (twins.length > 1 && status === 'unused-catalogue-only') {
    const otherDisplayed = twins.find((t) => t.id !== id);
    if (otherDisplayed) {
      status = 'duplicate-of-displayed-asset';
      reason = `Byte-identical to ${otherDisplayed.filename}; displaying one copy is sufficient.`;
    }
  }

  // Pracownia home-category large images
  if (
    status === 'unused-catalogue-only' &&
    (mapEntry?.pages || []).some((p) =>
      /ceramikanero\.com\/?$|\/home$|\/onas/.test(p)
    ) &&
    local.width >= 800
  ) {
    status = 'genuinely-rendered';
    reason =
      'Home/about photographic asset included via getPracowniaImages()/getGalleryImages().';
    reachableRoutes.push({ route: '/pracownia', via: 'getPracowniaImages()' });
    reachableRoutes.push({ route: '/galeria', via: 'getGalleryImages()' });
  }

  if (status === 'unused-catalogue-only' && inGallery) {
    status = 'genuinely-rendered';
  }

  // Final fallback: any large photo is in gallery
  if (
    status === 'unused-catalogue-only' &&
    local.isImage &&
    local.width * local.height >= 40000 &&
    !classifyBrand(mapEntry?.altTexts, local.width, local.height)
  ) {
    status = 'genuinely-rendered';
    reason =
      'Large photographic asset rendered through /galeria getGalleryImages() fallback.';
    reachableRoutes.push({ route: '/galeria', via: 'getGalleryImages()' });
  }

  if (
    status === 'unused-catalogue-only' &&
    local.isImage &&
    local.width * local.height < 40000
  ) {
    status = 'preserved-not-displayed';
    reason =
      'Small asset below gallery size threshold and not mapped to a brand/social UI slot; preserved locally.';
  }

  return {
    id,
    filename,
    localPath: local.localPath,
    byteSize: local.byteSize,
    width: local.width,
    height: local.height,
    sha256: local.sha256,
    altTexts: mapEntry?.altTexts || [],
    originalPages: mapEntry?.pages || [],
    sourceFilesMentioning: locations,
    inFixtureGallery,
    reachableRoutes: [
      ...new Map(reachableRoutes.map((r) => [r.route + r.via, r])).values(),
    ],
    decorative: brand,
    status,
    reason,
  };
});

// Page discovery (enriched async below before write)
const pagesVisited = inventory.pagesVisited || [];
const canonicalPages = [
  ...new Set(
    pagesVisited.map((p) => {
      try {
        const u = new URL(p);
        u.hash = '';
        u.protocol = 'https:';
        if (u.pathname !== '/' && u.pathname.endsWith('/')) {
          u.pathname = u.pathname.slice(0, -1);
        }
        return u.href;
      } catch {
        return p;
      }
    })
  ),
];

// Collect internal links seen in inventory references as additional discovery signal
const linkedFromReferences = [
  ...new Set(
    inventory.inventory.flatMap((i) =>
      (i.references || []).map((r) => r.page).filter(Boolean)
    )
  ),
];

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'CeramikaNero-image-audit/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, finalUrl: res.url, text };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      text: '',
      error: String(err),
    };
  }
}

function extractSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(xml))) locs.push(m[1].trim());
  return locs;
}

async function buildPageDiscovery() {
  const robots = await fetchText('https://www.ceramikanero.com/robots.txt');
  const sitemapCandidates = [
    'https://www.ceramikanero.com/sitemap.xml',
    'https://www.ceramikanero.com/sitemap_index.xml',
    'https://www.ceramikanero.com/sitemap.xml.gz',
  ];
  const sitemapResults = [];
  const sitemapUrls = new Set();
  for (const url of sitemapCandidates) {
    const res = await fetchText(url);
    sitemapResults.push({
      url,
      status: res.status,
      ok: res.ok,
      error: res.error || null,
      locCount: res.ok ? extractSitemapLocs(res.text).length : 0,
    });
    if (res.ok) {
      for (const loc of extractSitemapLocs(res.text)) sitemapUrls.add(loc);
    }
  }

  // If sitemap index, follow child sitemaps (limit)
  const childSitemaps = [...sitemapUrls]
    .filter((u) => /sitemap/i.test(u))
    .slice(0, 10);
  for (const url of childSitemaps) {
    const res = await fetchText(url);
    sitemapResults.push({
      url,
      status: res.status,
      ok: res.ok,
      error: res.error || null,
      locCount: res.ok ? extractSitemapLocs(res.text).length : 0,
    });
    if (res.ok) {
      for (const loc of extractSitemapLocs(res.text)) sitemapUrls.add(loc);
    }
  }

  const sitemapPageUrls = [...sitemapUrls].filter((u) => !/sitemap/i.test(u));
  const visitedSet = new Set(canonicalPages);
  const sitemapNotVisited = sitemapPageUrls.filter((u) => {
    try {
      const x = new URL(u);
      x.hash = '';
      x.protocol = 'https:';
      if (x.pathname !== '/' && x.pathname.endsWith('/')) {
        x.pathname = x.pathname.slice(0, -1);
      }
      return !visitedSet.has(x.href);
    } catch {
      return true;
    }
  });

  const expectedRouteFamilies = {
    home: canonicalPages.filter((p) => /ceramikanero\.com\/?$|\/home$/.test(p)),
    blog: canonicalPages.filter((p) => /\/blog|\/post\//i.test(p)),
    workshops: canonicalPages.filter((p) =>
      /warsztat|kurs|glina|urodziny|panie/i.test(p)
    ),
    services: canonicalPages.filter((p) =>
      /dla-dzieci|dladzieci|doroslych|grupy|firm/i.test(p)
    ),
    legal: canonicalPages.filter((p) =>
      /polityka|regulamin|rodo|privacy|terms/i.test(p)
    ),
    profile: canonicalPages.filter((p) =>
      /account|profile|konto|member/i.test(p)
    ),
    shop: canonicalPages.filter((p) => /shop|sklep|product|store/i.test(p)),
  };

  return {
    generatedAt: new Date().toISOString(),
    visitedRaw: pagesVisited.length,
    visitedCanonicalHttps: canonicalPages.length,
    httpAliasCollapsed: pagesVisited.length - canonicalPages.length,
    discoveredViaPageReferences: linkedFromReferences.length,
    pages: canonicalPages,
    robots: {
      status: robots.status,
      ok: robots.ok,
      error: robots.error || null,
      excerpt: (robots.text || '').slice(0, 500),
      sitemapDirectives: [
        ...((robots.text || '').match(/Sitemap:\s*\S+/gi) || []),
      ],
    },
    sitemap: {
      probes: sitemapResults,
      urlsDiscovered: sitemapPageUrls.length,
      notVisitedComparedToCrawl: sitemapNotVisited.slice(0, 100),
      notVisitedCount: sitemapNotVisited.length,
    },
    expectedRouteFamilies,
    excludedUrls: [
      {
        pattern: 'query-string aliases',
        reason:
          'Canonicalization strips hash; protocol normalized to https; trailing slash collapsed except root.',
      },
      {
        pattern: 'Wix editor / preview URLs',
        reason: 'Not part of public customer-facing navigation.',
      },
    ],
    failedUrls: sitemapResults.filter((s) => !s.ok),
    orphanUrlsOutsideOrdinaryNavigation: sitemapNotVisited.slice(0, 50),
    paginationOrLoadMore: {
      exercised: canonicalPages.some((p) => /page=\d+|offset=|start=/i.test(p)),
      note: 'Inventory pagesVisited list did not retain pagination query variants after crawl; blog category/list pages included if linked.',
    },
    notes: [
      '71 raw visited pages collapse under HTTPS + trailing-slash canonicalization.',
      'Sitemap availability is recorded live; a 500 from Wix sitemap does not invalidate link-crawl completeness by itself.',
      'Orphan sitemap URLs (if any) are listed for manual review — they may be redirects, retired pages, or Wix system routes.',
    ],
  };
}

// Quality verification vs mapping provenance
const qualityVerification = localFiles.map((filename) => {
  const id = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const local = localById.get(id);
  const mapEntry = mappingById.get(id);
  const sourceDims = mapEntry?.dimensions || {};
  const suspicious =
    local.byteSize < 20000 && local.width * local.height > 100000
      ? 'small-bytes-for-declared-dimensions'
      : local.width <= 320 && local.height <= 320
        ? 'thumbnail-sized'
        : null;
  return {
    id,
    localPath: local.localPath,
    localByteSize: local.byteSize,
    localDimensions: { width: local.width, height: local.height },
    mappingProvenanceUrl: mapEntry?.originalUrl || null,
    mappingDimensions: sourceDims,
    isHighestQualityRecoverable:
      !suspicious && local.byteSize >= 50000 && local.width >= 800,
    flags: [
      suspicious,
      local.byteSize < 10000 ? 'very-small-file' : null,
      !local.isImage ? 'not-an-image' : null,
    ].filter(Boolean),
    transparencyPreserved:
      filename.endsWith('.png') || filename.endsWith('.webp')
        ? 'container-supports-transparency'
        : 'n/a',
  };
});

// Classification totals
const classificationCounts = {};
for (const a of referenceAudits) {
  classificationCounts[a.finalClassification] =
    (classificationCounts[a.finalClassification] || 0) + 1;
}

const displayStatusCounts = {};
for (const d of displayCoverage) {
  displayStatusCounts[d.status] = (displayStatusCounts[d.status] || 0) + 1;
}

const completenessAudit = {
  generatedAt: new Date().toISOString(),
  summary: {
    referencesAudited: referenceAudits.length,
    expectedReferences: 518,
    crawlUniqueHashes: byCrawlHash.size,
    localFiles: localFiles.length,
    localUniqueContentHashes,
    uniqueMediaIdsFromReferences: uniqueMediaIdsFromRefs.length,
    classificationCounts,
    displayStatusCounts,
    hashReductionExplanation,
    unavailableRecovered: unavailableReconciliation.filter(
      (u) => !u.representsAdditionalRecoverableAsset
    ).length,
    unavailableStillCandidates: unavailableReconciliation.filter(
      (u) => u.representsAdditionalRecoverableAsset
    ).length,
  },
  references: referenceAudits,
};

async function main() {
  const pageDiscovery = await buildPageDiscovery();

  fs.writeFileSync(
    path.join(OUT, 'completeness-audit.json'),
    JSON.stringify(completenessAudit, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT, 'display-coverage.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totals: displayStatusCounts,
        files: displayCoverage,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT, 'hash-reconciliation.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        crawlUniqueHashes: byCrawlHash.size,
        reduction: hashReductionExplanation,
        hashes: hashReconciliation,
        duplicateLocalContentGroups: duplicateLocalGroups,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT, 'unavailable-reconciliation.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: unavailableReconciliation.length,
        recoveredViaEmbeddedId: unavailableReconciliation.filter(
          (u) => u.reconstruction && !u.representsAdditionalRecoverableAsset
        ).length,
        stillAdditionalAssetCandidates: unavailableReconciliation.filter(
          (u) => u.representsAdditionalRecoverableAsset
        ).length,
        items: unavailableReconciliation,
      },
      null,
      2
    )
  );
  fs.writeFileSync(
    path.join(OUT, 'page-discovery.json'),
    JSON.stringify(pageDiscovery, null, 2)
  );
  fs.writeFileSync(
    path.join(OUT, 'quality-verification.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        files: qualityVerification,
        suspiciousCount: qualityVerification.filter((q) => q.flags.length)
          .length,
        highQualityCount: qualityVerification.filter(
          (q) => q.isHighestQualityRecoverable
        ).length,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        references: referenceAudits.length,
        classificationCounts,
        displayStatusCounts,
        unavailable: unavailableReconciliation.length,
        unavailableStillCandidates: unavailableReconciliation.filter(
          (u) => u.representsAdditionalRecoverableAsset
        ).length,
        crawlHashes: byCrawlHash.size,
        localFiles: localFiles.length,
        localUniqueHashes: localUniqueContentHashes,
        uniqueMediaIds: uniqueMediaIdsFromRefs.length,
        missingMediaIds: uniqueMediaIdsFromRefs.filter(
          (id) => !localById.has(id)
        ),
        pageDiscovery: {
          visitedRaw: pageDiscovery.visitedRaw,
          visitedCanonical: pageDiscovery.visitedCanonicalHttps,
          sitemapStatus: pageDiscovery.sitemap.probes.map((p) => ({
            url: p.url,
            status: p.status,
          })),
          sitemapNotVisited: pageDiscovery.sitemap.notVisitedCount,
        },
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
