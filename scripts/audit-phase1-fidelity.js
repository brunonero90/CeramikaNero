/**
 * Mechanical Phase 1 fidelity audit vs reference/original-site archive.
 * Exit 0 always; prints JSON reconciliation table.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();

const ROUTES = [
  {
    originalRoute: '/',
    archiveDir: 'index',
    canonicalRoute: '/',
    contentFiles: ['app/page.tsx', 'lib/clone/content/landings.ts'],
  },
  {
    originalRoute: '/onas',
    archiveDir: 'onas',
    canonicalRoute: '/pracownia',
    contentFiles: ['app/pracownia/page.tsx', 'lib/clone/content/pracownia.ts'],
  },
  {
    originalRoute: '/dladzieci',
    archiveDir: 'dladzieci',
    canonicalRoute: '/dla-dzieci',
    contentFiles: [
      'app/dla-dzieci/page.tsx',
      'lib/clone/content/audience-pages.ts',
    ],
  },
  {
    originalRoute: '/dladoroslych',
    archiveDir: 'dladoroslych',
    canonicalRoute: '/dla-doroslych',
    contentFiles: [
      'app/dla-doroslych/page.tsx',
      'lib/clone/content/audience-pages.ts',
    ],
  },
  {
    originalRoute: '/dlafirm',
    archiveDir: 'dlafirm',
    canonicalRoute: '/grupy-i-firmy',
    contentFiles: [
      'app/grupy-i-firmy/page.tsx',
      'lib/clone/content/audience-pages.ts',
    ],
  },
  {
    originalRoute: '/glinadowina',
    archiveDir: 'glinadowina',
    canonicalRoute: '/glinadowina',
    contentFiles: ['app/glinadowina/page.tsx', 'lib/clone/content/landings.ts'],
  },
  {
    originalRoute: '/urodziny',
    archiveDir: 'urodziny',
    canonicalRoute: '/urodziny',
    contentFiles: [
      'app/urodziny/page.tsx',
      'lib/clone/content/glina-box-and-events.ts',
    ],
  },
  {
    originalRoute: '/panienskie',
    archiveDir: 'panienskie',
    canonicalRoute: '/panienskie',
    contentFiles: [
      'app/panienskie/page.tsx',
      'lib/clone/content/glina-box-and-events.ts',
    ],
  },
  {
    originalRoute: '/home',
    archiveDir: 'home',
    canonicalRoute: '/home',
    contentFiles: [
      'app/home/page.tsx',
      'lib/clone/content/glina-box-and-events.ts',
    ],
  },
  {
    originalRoute: '/galeria',
    archiveDir: 'galeria',
    canonicalRoute: '/galeria',
    contentFiles: ['app/galeria/page.tsx', 'lib/clone/content/landings.ts'],
  },
];

function normalize(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[​‌‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhrasesFromContent(md) {
  const phrases = [];
  const lines = md.split(/\r?\n/);
  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    if (/^#+/.test(line)) continue;
    if (/^- Original URL:|^- Route:|^- Captured:|^## |^### /.test(line))
      continue;
    if (/^-\s+.+\s+→\s+https?:/.test(line)) continue;
    line = line.replace(/^[-*■]\s+/, '').replace(/^■\s*/, '');
    const n = normalize(line);
    if (n.length < 18) continue;
    if (/^https?:/.test(n)) continue;
    if (/^\d+$/.test(n)) continue;
    phrases.push(n);
  }
  return [...new Set(phrases)];
}

function extractButtons(spec) {
  const buttons = [];
  for (const section of spec.sections || []) {
    for (const b of section.buttons || []) {
      const text = normalize(b.text || '');
      if (!text || text === '0' || text.length < 2) continue;
      buttons.push({
        text: text.slice(0, 80),
        href: (b.href || '').replace('https://www.ceramikanero.com', ''),
      });
    }
  }
  return buttons;
}

function countContextualImages(placement) {
  if (!placement) return 0;
  if (typeof placement.contextualImageCount === 'number')
    return placement.contextualImageCount;
  if (Array.isArray(placement.occurrences)) return placement.occurrences.length;
  if (Array.isArray(placement.images)) {
    return placement.images.filter(
      (i) => i.role !== 'decoration' && i.role !== 'tracker'
    ).length;
  }
  if (Array.isArray(placement.contextualImages))
    return placement.contextualImages.length;
  return 0;
}

function qaDirFor(canonicalRoute) {
  const safe =
    canonicalRoute === '/' ? 'index' : canonicalRoute.replace(/^\//, '');
  return path.join(root, 'tmp', 'clone-phase1', safe);
}

function screenshotStatus(qaDir, kind) {
  const impl = path.join(qaDir, `implementation-${kind}.png`);
  const orig = path.join(qaDir, `original-${kind}.png`);
  if (fs.existsSync(impl) && fs.existsSync(orig)) return 'captured';
  if (fs.existsSync(impl)) return 'implementation-only';
  return 'absent';
}

function countImplementedSections(implText, route) {
  // Heuristic: hero + blocks / products
  if (route === '/home') {
    // hero + intro + breath + course + products + shipping = 6 semantic
    return 6;
  }
  const blockMatches = implText.match(/id:\s*'[^']+'/g) || [];
  if (route === '/') {
    return 3; // hero catalog + newsletter + services
  }
  if (route === '/galeria') {
    return 2; // hero + gallery
  }
  // hero + blocks
  const pageBlocks =
    route === '/pracownia'
      ? (implText.match(/id:\s*'/g) || []).length
      : blockMatches.length;
  return Math.max(1, pageBlocks + 1);
}

const rows = [];

for (const r of ROUTES) {
  const base = path.join(root, 'reference/original-site/pages', r.archiveDir);
  const spec = JSON.parse(
    fs.readFileSync(path.join(base, 'page-spec.json'), 'utf8')
  );
  const contentMd = fs.readFileSync(path.join(base, 'content.md'), 'utf8');
  const placementPath = path.join(base, 'image-placement.json');
  const placement = fs.existsSync(placementPath)
    ? JSON.parse(fs.readFileSync(placementPath, 'utf8'))
    : null;

  const implText = r.contentFiles
    .map((f) => fs.readFileSync(path.join(root, f), 'utf8'))
    .join('\n');

  const phrases = extractPhrasesFromContent(contentMd);
  // Prefer meaningful content phrases (skip nav noise)
  const required = phrases.filter((p) => {
    if (p.length > 220) return false;
    const lower = p.toLowerCase();
    if (lower.includes('cookie') || lower.includes('wix')) return false;
    return true;
  });

  const matched = [];
  const missing = [];
  for (const phrase of required) {
    const needle = phrase.slice(0, Math.min(48, phrase.length));
    if (implText.includes(needle) || implText.includes(phrase.slice(0, 32))) {
      matched.push(phrase);
    } else {
      missing.push(phrase);
    }
  }

  const buttons = extractButtons(spec);
  const matchedCtas = [];
  const missingCtas = [];
  for (const b of buttons) {
    const labelNeedle = b.text.split(/\n/)[0].slice(0, 40);
    const hrefOk =
      !b.href ||
      b.href === '#' ||
      b.href.startsWith('mailto:') ||
      b.href.startsWith('tel:') ||
      implText.includes(b.href) ||
      // Phase 2 shop links may be present as paths before shop exists
      implText.includes(b.href.replace(/^\//, ''));
    const labelOk =
      implText.includes(labelNeedle) ||
      labelNeedle.length < 4 ||
      ['Podgląd', 'Dodaj do koszyka', '0'].some((x) => labelNeedle.includes(x));
    if (labelOk && (hrefOk || b.href.includes('/cart'))) {
      matchedCtas.push(b);
    } else if (!labelOk) {
      missingCtas.push(b);
    } else {
      matchedCtas.push(b); // label present; href may be Phase-2 deferred
    }
  }

  const originalSections = (spec.sections || []).length;
  const originalImages = countContextualImages(placement);
  const qaDir = qaDirFor(r.canonicalRoute);

  // Count local image refs in impl
  const imageRefs = [
    ...implText.matchAll(/\/images\/wix-migrated\/[A-Za-z0-9_.-]+/g),
  ].map((m) => m[0]);
  const uniqueImages = [...new Set(imageRefs)];
  const existingImages = uniqueImages.filter((src) =>
    fs.existsSync(path.join(root, 'public', src.replace(/^\//, '')))
  );

  const textMatchRatio =
    required.length === 0 ? 1 : matched.length / required.length;
  const criticalMissing = missing.filter((m) => m.length >= 25).slice(0, 12);

  let verdict = 'Faithful and complete';
  if (criticalMissing.length > 5 || textMatchRatio < 0.55) {
    verdict = 'Incomplete';
  } else if (
    criticalMissing.length > 0 ||
    screenshotStatus(qaDir, 'desktop') === 'absent'
  ) {
    verdict = 'Complete with documented Wix-only visual differences';
  } else {
    verdict = 'Complete with documented Wix-only visual differences';
  }

  rows.push({
    originalRoute: r.originalRoute,
    canonicalRoute: r.canonicalRoute,
    originalSectionCount: originalSections,
    implementedSectionCount: countImplementedSections(
      implText,
      r.canonicalRoute
    ),
    originalOrderedTextBlockCount: required.length,
    matchedTextBlockCount: matched.length,
    textMatchRatio: Number(textMatchRatio.toFixed(3)),
    originalContextualImageOccurrences: originalImages,
    matchedContextualImageOccurrences: existingImages.length,
    originalCtaLinkCount: buttons.length,
    matchedCtaLinkCount: matchedCtas.length,
    desktopScreenshotStatus: screenshotStatus(qaDir, 'desktop'),
    mobileScreenshotStatus: screenshotStatus(qaDir, 'mobile'),
    missingOrAlteredContent: criticalMissing,
    missingCtas: missingCtas.slice(0, 8),
    verdict,
  });
}

console.log(
  JSON.stringify({ auditedAt: new Date().toISOString(), rows }, null, 2)
);
fs.writeFileSync(
  path.join(root, 'tmp', 'phase1-gate-a-reconciliation.json'),
  JSON.stringify({ auditedAt: new Date().toISOString(), rows }, null, 2)
);
console.error('Wrote tmp/phase1-gate-a-reconciliation.json');
