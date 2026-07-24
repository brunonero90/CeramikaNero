const fs = require('fs');
const path = require('path');

const inventory = JSON.parse(
  fs.readFileSync(path.join('tmp/wix-crawl/inventory.json'), 'utf8')
);
const mapping = JSON.parse(
  fs.readFileSync(path.join('tmp/wix-crawl/image-mapping.json'), 'utf8')
);
const mediaTs = fs.readFileSync(
  'lib/database/fixtures/media-assets.ts',
  'utf8'
);
const codeFiles = [
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
]
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

const displayedIds = new Set();
for (const m of mapping) {
  const id = `wix-${m.id}`;
  const area = (m.dimensions.width || 0) * (m.dimensions.height || 0);
  if (
    codeFiles.includes(m.id) ||
    codeFiles.includes(id) ||
    codeFiles.includes(m.localPath)
  ) {
    displayedIds.add(m.id);
  }
  // Gallery shows all large photographic assets except explicit social icons.
  if (
    area >= 40000 &&
    !/facebook|instagram/i.test((m.altTexts || []).join(' '))
  ) {
    displayedIds.add(m.id);
  }
  if (
    m.usageCategory === 'branding' ||
    /facebook|instagram/i.test((m.altTexts || []).join(' '))
  ) {
    displayedIds.add(m.id);
  }
}

const statuses = mapping.map((m) => {
  let status = 'migrated_preserved_not_displayed';
  let reason =
    'Zachowane lokalnie; nie wyróżnione w aktualnym układzie stron (dostępne w katalogu mediów).';

  if (displayedIds.has(m.id)) {
    if (
      m.usageCategory === 'branding' ||
      /facebook|instagram|logo|partner/i.test((m.altTexts || []).join(' '))
    ) {
      status = 'migrated_brand_decorative';
      reason =
        'Wykorzystane jako branding / ikona społecznościowa / element dekoracyjny.';
    } else {
      status = 'migrated_and_displayed';
      reason =
        'Wyświetlane w galerii, na stronie głównej, w kartach warsztatów lub na stronach kategorii.';
    }
  }

  return {
    id: m.id,
    localPath: m.localPath,
    originalUrl: m.originalUrl,
    filename: m.filename,
    format: m.ext,
    width: m.dimensions.width,
    height: m.dimensions.height,
    fileSizeBytes: m.fileSizeBytes,
    usageCategory: m.usageCategory,
    altTexts: m.altTexts,
    pages: m.pages,
    status,
    reason,
  };
});

const unavailable = inventory.inventory
  .filter((i) => i.status === 'unavailable')
  .map((i) => ({
    url: i.url,
    reason: /ceramikanero\.com\/quality_auto/.test(i.url)
      ? 'Malformed relative path from Wix CDN transform (not a real asset).'
      : /\/v1\/fill\/w_\d+$/.test(i.url)
        ? 'Truncated Wix transform URL; same media captured via other variants.'
        : 'Could not download during crawl hash step.',
  }));

const report = {
  generatedAt: new Date().toISOString(),
  originalSite: 'https://www.ceramikanero.com/',
  pagesDiscovered: inventory.pagesVisited,
  totals: {
    imageReferencesFound: inventory.totalImageUrls,
    uniqueContentHashesInCrawl: inventory.uniqueFiles,
    uniqueLocalFiles: mapping.length,
    mediaFixtureEntries: (mediaTs.match(/id: 'wix-/g) || []).length,
    migratedAndDisplayed: statuses.filter(
      (s) => s.status === 'migrated_and_displayed'
    ).length,
    migratedBrandDecorative: statuses.filter(
      (s) => s.status === 'migrated_brand_decorative'
    ).length,
    preservedNotDisplayed: statuses.filter(
      (s) => s.status === 'migrated_preserved_not_displayed'
    ).length,
    unavailableReferences: unavailable.length,
  },
  urlToLocalPath: Object.fromEntries(
    mapping.map((m) => [m.originalUrl, m.localPath])
  ),
  statuses,
  unavailable,
};

fs.writeFileSync(
  'tmp/wix-crawl/migration-report.json',
  JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report.totals, null, 2));
console.log('Pages:', report.pagesDiscovered.length);
console.log('Report written to tmp/wix-crawl/migration-report.json');
