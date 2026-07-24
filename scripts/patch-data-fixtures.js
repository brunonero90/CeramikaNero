const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(
  __dirname,
  '..',
  'lib',
  'database',
  'fixtures',
  'data.ts'
);
const MAPPING_PATH = path.join(
  __dirname,
  '..',
  'tmp',
  'wix-crawl',
  'image-mapping.json'
);

const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
let content = fs.readFileSync(DATA_PATH, 'utf8');

function pickBest(predicate, minArea = 20000) {
  return mapping
    .filter(
      (m) =>
        predicate(m) &&
        (m.dimensions.width || 0) * (m.dimensions.height || 0) >= minArea
    )
    .sort(
      (a, b) =>
        (b.dimensions.width || 0) * (b.dimensions.height || 0) -
        (a.dimensions.width || 0) * (a.dimensions.height || 0)
    )[0];
}

function mediaId(m) {
  return m ? `wix-${m.id}` : null;
}

// Ensure mediaAssets uses wixMediaAssets
if (
  !content.includes('export const mediaAssets: MediaAsset[] = wixMediaAssets;')
) {
  content = content.replace(
    /export const mediaAssets: MediaAsset\[\] = \[[\s\S]*?\];\n\nexport const workshops/,
    'export const mediaAssets: MediaAsset[] = wixMediaAssets;\n\nexport const workshops'
  );
}

if (!content.includes("import { wixMediaAssets } from './media-assets';")) {
  content = content.replace(
    "from '@/lib/database/types';",
    "from '@/lib/database/types';\nimport { wixMediaAssets } from './media-assets';"
  );
}

const workshopPicks = {
  'ceramika-dla-doroslych': pickBest((m) =>
    (m.pages || []).some((p) =>
      /dladoroslych|service-page\/ceramika-dla-doros/.test(p)
    )
  ),
  'glina-do-wina': pickBest((m) =>
    (m.pages || []).some((p) =>
      /glinadowina|service-page\/glina-do-wina/.test(p)
    )
  ),
  'ceramika-dla-dzieci': pickBest((m) =>
    (m.pages || []).some((p) => /dladzieci/.test(p))
  ),
  'kurs-rysunku-dla-mlodziezy': pickBest((m) =>
    /rysunek|malarstw/i.test((m.altTexts || []).join(' '))
  ),
  'kurs-rysunku-i-architektury': pickBest((m) =>
    /architektur|rysunek/i.test((m.altTexts || []).join(' '))
  ),
  'glina-i-rodzina': pickBest(
    (m) =>
      (m.pages || []).some((p) => /glina-i-rodzina|urodziny|rodzin/.test(p)) ||
      /rodzin/i.test((m.altTexts || []).join(' '))
  ),
  'urodziny-ceramiczne': pickBest(
    (m) =>
      (m.pages || []).some((p) => /urodziny/.test(p)) ||
      /urodzin/i.test((m.altTexts || []).join(' '))
  ),
  'warsztaty-dla-firm': pickBest(
    (m) =>
      (m.pages || []).some((p) => /dlafirm/.test(p)) ||
      /firm|integrac/i.test((m.altTexts || []).join(' '))
  ),
};

// Replace featuredMediaId inside each workshop block by slug proximity is hard;
// instead replace known sequential workshop featuredMediaId values with picks.
const workshopFeaturedIds = Object.values(workshopPicks)
  .map(mediaId)
  .filter(Boolean);
const featuredRegex = /featuredMediaId: 'wix-[^']+'/g;
let featuredIndex = 0;
content = content.replace(featuredRegex, (match) => {
  // Keep blog featured media separate — handled below
  if (featuredIndex < workshopFeaturedIds.length) {
    const replacement = `featuredMediaId: '${workshopFeaturedIds[featuredIndex]}'`;
    featuredIndex += 1;
    return replacement;
  }
  return match;
});

const blogHero = pickBest(
  (m) =>
    (m.pages || []).some((p) => /\/post\//.test(p)) ||
    /pracowni/i.test((m.altTexts || []).join(' '))
);
if (blogHero) {
  // Last featuredMediaId in blog section — replace the last occurrence after blog title
  const blogSection = content.indexOf("id: 'blog-1'");
  if (blogSection >= 0) {
    content =
      content.slice(0, blogSection) +
      content
        .slice(blogSection)
        .replace(
          /featuredMediaId: 'wix-[^']+'/,
          `featuredMediaId: '${mediaId(blogHero)}'`
        );
  }
}

// Build gallery from content images that appear on the original gallery page,
// plus other strong content photos not already used as tiny branding assets.
const galleryCandidates = mapping
  .filter((m) => {
    const area = (m.dimensions.width || 0) * (m.dimensions.height || 0);
    if (area < 40000) return false;
    if (m.usageCategory === 'branding' || m.usageCategory === 'social')
      return false;
    const onGallery = (m.pages || []).some((p) => /\/galeria/.test(p));
    const onHome = (m.pages || []).some((p) =>
      /ceramikanero\.com\/?$|\/home$|\/onas/.test(p)
    );
    const photographic =
      /\.(jpe?g|webp)$/i.test(m.filename) ||
      /DSC_|PHOTO-|ceramik|warsztat|glina|pracowni/i.test(
        (m.altTexts || []).join(' ')
      );
    return onGallery || (onHome && photographic) || photographic;
  })
  .sort((a, b) => {
    const aGal = (a.pages || []).some((p) => /\/galeria/.test(p)) ? 0 : 1;
    const bGal = (b.pages || []).some((p) => /\/galeria/.test(p)) ? 0 : 1;
    if (aGal !== bGal) return aGal - bGal;
    return (
      (b.dimensions.width || 0) * (b.dimensions.height || 0) -
      (a.dimensions.width || 0) * (a.dimensions.height || 0)
    );
  });

// Deduplicate near-identical display by checksum already unique; keep all unique files
const galleryItems = galleryCandidates
  .map((m, i) => {
    const titleRaw =
      (m.altTexts && m.altTexts[0]) || `Praca ceramiczna ${i + 1}`;
    const title = titleRaw
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
    return `  {
    id: 'gal-${i + 1}',
    mediaAssetId: '${mediaId(m)}',
    title: '${title}',
    description: 'Zdjęcie z pracowni Ceramika Nero.',
    category: 'ceramika',
    displayOrder: ${(i + 1) * 10},
    isVisible: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },`;
  })
  .join('\n');

content = content.replace(
  /export const galleryItems: GalleryItem\[\] = \[[\s\S]*?\];\n\nexport const siteSettings/,
  `export const galleryItems: GalleryItem[] = [\n${galleryItems}\n];\n\nexport const siteSettings`
);

fs.writeFileSync(DATA_PATH, content);
console.log('Patched data.ts');
console.log('Workshop featured picks:', workshopFeaturedIds);
console.log('Blog hero:', mediaId(blogHero));
console.log(`Gallery items: ${galleryCandidates.length}`);
