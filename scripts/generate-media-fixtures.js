const fs = require('fs');
const path = require('path');

const MAPPING_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'image-mapping.json'
);
const OUTPUT_PATH = path.join(
  __dirname,
  '..',
  'lib',
  'database',
  'fixtures',
  'media-assets.ts'
);

const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));

function categorizeImage(m) {
  const pages = m.pages || [];
  const area = (m.dimensions.width || 0) * (m.dimensions.height || 0);
  if (m.usageCategory === 'branding' || area <= 8000) return 'social';
  if (m.usageCategory === 'social') return 'social';
  if (pages.some((p) => /\/galeria/.test(p))) return 'gallery';
  if (pages.some((p) => /ceramikanero\.com\/?$|\/home$|\/onas/.test(p)))
    return 'home';
  if (pages.some((p) => /\/service-page\//.test(p))) return 'workshop';
  if (pages.some((p) => /\/post\//.test(p))) return 'blog';
  if (
    pages.some((p) =>
      /\/dladzieci|\/dladoroslych|\/dlafirm|\/glinadowina|\/urodziny|\/panienskie/.test(
        p
      )
    )
  ) {
    return 'category';
  }
  return 'gallery';
}

function polishAlt(m) {
  const raw = (m.altTexts && m.altTexts[0] ? m.altTexts[0] : '').trim();
  const lower = raw.toLowerCase();

  if (/^facebook/.test(lower)) return 'Facebook';
  if (/^instagram/.test(lower)) return 'Instagram';
  if (/partner/.test(lower)) return 'Naklejka partnera Ceramika Nero';
  if (/pracownia ceramika nero\.png/i.test(raw))
    return 'Logo pracowni Ceramika Nero';

  // Prefer meaningful Polish alt already present on the original site
  if (
    raw &&
    !/\.(jpe?g|png|webp|gif)$/i.test(raw) &&
    !/^DSC_|^PHOTO-|^IMG_|^[0-9a-f]{8,}/i.test(raw) &&
    raw.length > 3
  ) {
    return raw.replace(/"/g, '\\"').replace(/\s+/g, ' ').trim();
  }

  if (m.usageCategory === 'branding' || m.usageCategory === 'social') {
    return '';
  }

  if ((m.pages || []).some((p) => /\/galeria/.test(p))) {
    return 'Praca ceramiczna z pracowni Ceramika Nero';
  }
  if ((m.pages || []).some((p) => /\/dladzieci/.test(p))) {
    return 'Warsztaty ceramiczne dla dzieci w Ceramika Nero';
  }
  if ((m.pages || []).some((p) => /\/dladoroslych/.test(p))) {
    return 'Warsztaty ceramiczne dla dorosłych w Ceramika Nero';
  }
  if ((m.pages || []).some((p) => /\/glinadowina/.test(p))) {
    return 'Warsztaty Glina do wina w Ceramika Nero';
  }
  if ((m.pages || []).some((p) => /\/urodziny/.test(p))) {
    return 'Urodziny z ceramiką w Ceramika Nero';
  }
  if ((m.pages || []).some((p) => /\/dlafirm/.test(p))) {
    return 'Warsztaty firmowe w Ceramika Nero';
  }
  if (
    (m.pages || []).some((p) => /\/onas|\/home|ceramikanero\.com\/?$/.test(p))
  ) {
    return 'Pracownia Ceramika Nero w Suchym Lesie';
  }

  return 'Zdjęcie z pracowni Ceramika Nero';
}

const entries = mapping.map((m) => {
  const category = categorizeImage(m);
  const originalFilename =
    (m.originalUrl || '').split('/').pop()?.split('?')[0] || m.filename;
  return {
    id: `wix-${m.id}`,
    category,
    originalFilename: originalFilename.replace(/"/g, '\\"'),
    storageBucket: 'public',
    storagePath: `images/wix-migrated/${m.filename}`,
    mimeType: m.ext === 'jpeg' ? 'image/jpeg' : `image/${m.ext}`,
    width: m.dimensions.width || 0,
    height: m.dimensions.height || 0,
    fileSizeBytes: m.fileSizeBytes,
    altText: polishAlt(m),
    caption: null,
    source: 'wix_import',
    wixUrl: m.originalUrl,
    checksum: m.sha256,
    archivedAt: null,
  };
});

const lines = [];
lines.push(`import type { MediaAsset } from '@/lib/database/types';`);
lines.push(``);
lines.push(`/**`);
lines.push(` * Migrated media assets from the original Wix website.`);
lines.push(
  ` * These assets are stored locally under public/images/wix-migrated/.`
);
lines.push(` */`);
lines.push(`export const wixMediaAssets: MediaAsset[] = [`);

for (const e of entries) {
  lines.push(`  {`);
  lines.push(`    id: '${e.id}',`);
  lines.push(`    originalFilename: "${e.originalFilename}",`);
  lines.push(`    storageBucket: '${e.storageBucket}',`);
  lines.push(`    storagePath: '${e.storagePath}',`);
  lines.push(`    mimeType: '${e.mimeType}',`);
  lines.push(`    width: ${e.width},`);
  lines.push(`    height: ${e.height},`);
  lines.push(`    fileSizeBytes: ${e.fileSizeBytes},`);
  lines.push(`    altText: "${e.altText}",`);
  lines.push(`    caption: null,`);
  lines.push(`    source: 'wix_import',`);
  lines.push(`    wixUrl: '${e.wixUrl}',`);
  lines.push(`    checksum: '${e.checksum}',`);
  lines.push(`    archivedAt: null,`);
  lines.push(`  },`);
}
lines.push(`];`);
lines.push(``);
lines.push(
  `export const wixMediaById = new Map(wixMediaAssets.map((m) => [m.id, m]));`
);
lines.push(``);
lines.push(`export const wixMediaCategories = new Map<string, string>([`);
lines.push(
  `${entries.map((e) => `  ['${e.id}', '${e.category}'],`).join('\n')}`
);
lines.push(`]);`);
lines.push(``);
lines.push(
  `export function getWixMediaByCategory(category: 'social' | 'home' | 'about' | 'workshop' | 'blog' | 'category' | 'gallery') {`
);
lines.push(
  `  return wixMediaAssets.filter((m) => wixMediaCategories.get(m.id) === category);`
);
lines.push(`}`);
lines.push(``);

fs.writeFileSync(OUTPUT_PATH, lines.join('\n'));
console.log(`Generated ${OUTPUT_PATH} with ${entries.length} media assets.`);
