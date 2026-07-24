/**
 * Merge recovered orphan-page Ceramika assets into image-mapping.json
 * and regenerate media fixtures.
 */
const fs = require('fs');
const path = require('path');
const { imageSize } = require('image-size');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const MAPPING_PATH = path.join(ROOT, 'tmp', 'wix-crawl', 'image-mapping.json');
const ORPHAN_PATH = path.join(
  ROOT,
  'tmp',
  'wix-crawl',
  'orphan-page-recovery.json'
);
const LOCAL = path.join(ROOT, 'public', 'images', 'wix-migrated');

const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
const orphan = JSON.parse(fs.readFileSync(ORPHAN_PATH, 'utf8'));

const CERAMIKA_RECOVERED = new Set([
  '747d6f_aa1bfec10d124209aa38d0d0dcbc1583',
  '747d6f_90fd3fe84ad246c3b4f72ead538bc878',
  '747d6f_8a2d596fd10b4cd98573ac95e0eb4e16',
  '747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b',
]);

const ALT_BY_ID = {
  '747d6f_aa1bfec10d124209aa38d0d0dcbc1583':
    'Prezent z pracowni Ceramika Nero – opakowanie i suchy bukiet',
  '747d6f_90fd3fe84ad246c3b4f72ead538bc878':
    'Narzędzia ceramiczne i miseczka z gliny w pracowni Ceramika Nero',
  '747d6f_8a2d596fd10b4cd98573ac95e0eb4e16':
    'Ręcznie formowany kubek ceramiczny Ceramika Nero',
  '747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b':
    'Świece sojowe NERO i ceramiczny domek z pracowni',
};

const PAGE_BY_ID = {
  '747d6f_aa1bfec10d124209aa38d0d0dcbc1583': [
    'https://www.ceramikanero.com/vouchery',
  ],
  '747d6f_90fd3fe84ad246c3b4f72ead538bc878': [
    'https://www.ceramikanero.com/courses',
  ],
  '747d6f_8a2d596fd10b4cd98573ac95e0eb4e16': [
    'https://www.ceramikanero.com/courses',
  ],
  '747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b': [
    'https://www.ceramikanero.com/gift-card',
  ],
};

const existing = new Set(mapping.map((m) => m.id.toLowerCase()));
let added = 0;

for (const r of orphan.results) {
  if (!CERAMIKA_RECOVERED.has(r.id)) continue;
  if (existing.has(r.id.toLowerCase())) continue;
  const filename = r.filename;
  const abs = path.join(LOCAL, filename);
  if (!fs.existsSync(abs)) {
    console.error('missing file', filename);
    continue;
  }
  const buf = fs.readFileSync(abs);
  const dim = imageSize(buf);
  const ext = path.extname(filename).slice(1).toLowerCase();
  mapping.push({
    id: r.id,
    originalUrl: r.sourceUrl,
    localPath: `/images/wix-migrated/${filename}`,
    filename,
    ext,
    dimensions: {
      height: dim.height,
      width: dim.width,
      type: dim.type,
      ...(dim.orientation ? { orientation: dim.orientation } : {}),
    },
    fileSizeBytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    pages: PAGE_BY_ID[r.id] || [r.foundOn],
    contexts: ['img', 'orphan-sitemap-recovery'],
    altTexts: [ALT_BY_ID[r.id]],
    usageCategory: 'content',
    referenceCount: 1,
    allVariantUrls: [r.sourceUrl],
    recoveredDuringCompletenessAudit: true,
  });
  added++;
}

fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2));
console.log(
  JSON.stringify(
    {
      mappingCount: mapping.length,
      added,
      localFiles: fs.readdirSync(LOCAL).length,
    },
    null,
    2
  )
);
