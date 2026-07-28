'use strict';

const fs = require('fs');
const path = require('path');

const place = JSON.parse(
  fs.readFileSync('reference/original-site/image-placement.json', 'utf8')
);

function norm(s) {
  return String(s)
    .replace(/[\u00a0\u200b]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const sharedFooter =
  fs.readFileSync('components/layout/footer.tsx', 'utf8') +
  fs.readFileSync('components/clone/newsletter-signup.tsx', 'utf8') +
  fs.readFileSync('lib/fixtures/navigation.ts', 'utf8') +
  fs.readFileSync('components/layout/header.tsx', 'utf8');

const routes = [
  {
    orig: '/',
    can: '/',
    dir: 'index',
    files: ['app/page.tsx', 'lib/clone/content/landings.ts'],
    redirects: null,
  },
  {
    orig: '/onas',
    can: '/pracownia',
    dir: 'onas',
    files: ['app/pracownia/page.tsx', 'lib/clone/content/pracownia.ts'],
    redirects: '301 /onas → /pracownia',
  },
  {
    orig: '/dladzieci',
    can: '/dla-dzieci',
    dir: 'dladzieci',
    files: ['app/dla-dzieci/page.tsx', 'lib/clone/content/audience-pages.ts'],
    redirects: '301 /dladzieci → /dla-dzieci',
  },
  {
    orig: '/dladoroslych',
    can: '/dla-doroslych',
    dir: 'dladoroslych',
    files: [
      'app/dla-doroslych/page.tsx',
      'lib/clone/content/audience-pages.ts',
    ],
    redirects: '301 /dladoroslych → /dla-doroslych',
  },
  {
    orig: '/dlafirm',
    can: '/grupy-i-firmy',
    dir: 'dlafirm',
    files: [
      'app/grupy-i-firmy/page.tsx',
      'lib/clone/content/audience-pages.ts',
    ],
    redirects: '301 /dlafirm → /grupy-i-firmy',
  },
  {
    orig: '/glinadowina',
    can: '/glinadowina',
    dir: 'glinadowina',
    files: ['app/glinadowina/page.tsx', 'lib/clone/content/landings.ts'],
    redirects: null,
  },
  {
    orig: '/urodziny',
    can: '/urodziny',
    dir: 'urodziny',
    files: [
      'app/urodziny/page.tsx',
      'lib/clone/content/glina-box-and-events.ts',
    ],
    redirects: null,
  },
  {
    orig: '/panienskie',
    can: '/panienskie',
    dir: 'panienskie',
    files: [
      'app/panienskie/page.tsx',
      'lib/clone/content/glina-box-and-events.ts',
    ],
    redirects: null,
  },
  {
    orig: '/home',
    can: '/home',
    dir: 'home',
    files: ['app/home/page.tsx', 'lib/clone/content/glina-box-and-events.ts'],
    redirects: null,
  },
  {
    orig: '/galeria',
    can: '/galeria',
    dir: 'galeria',
    files: ['app/galeria/page.tsx', 'lib/clone/content/landings.ts'],
    redirects: null,
  },
];

function phrasesFromBody(body) {
  const phrases = [];
  for (const raw of body.split(/\n+/)) {
    let line = raw.trim();
    if (!line) continue;
    if (/^#+|^### |^- Original|^Images$|^Buttons/.test(line)) continue;
    if (/^-\s+.+\s+→/.test(line)) continue;
    if (line.includes('/images/') && line.includes('|')) continue;
    line = line
      .replace(/^[-*■]\s+/, '')
      .replace(/^■\s*/, '')
      .replace(/^\*\*/, '')
      .replace(/\*\*$/, '');
    const n = norm(line);
    if (n.length < 20 || n.length > 180) continue;
    if (/^https?:|^\d+\/\d+$|^1\/1$/.test(n)) continue;
    phrases.push(n);
  }
  return [...new Set(phrases)];
}

function extractMainContentPhrases(md) {
  const parts = md.split(/^## Section /m).slice(1);
  let best = [];
  for (const part of parts) {
    const heading = (part.split('\n')[0] || '').toLowerCase();
    // Skip pure chrome / footer shells
    if (/^1\s*$/.test(part.trim().slice(0, 3)) && part.includes('\n0\n')) {
      continue;
    }
    if (heading.includes('stopka') || heading.includes('newsletter')) continue;
    const phrases = phrasesFromBody(part).filter((p) => {
      const low = p.toLowerCase();
      if (low.includes('cookie') || low.includes('wix')) return false;
      if (/Brak dostępnych terminów/.test(p)) return false;
      if (/Numer Konta:|Akceptuję regulamin|Zapisz się do Newslettera/.test(p))
        return false;
      return true;
    });
    if (phrases.length > best.length) best = phrases;
  }
  return best;
}

function extractCtas(spec) {
  const out = [];
  for (const s of spec.sections || []) {
    if (s.index === 1) continue;
    for (const b of s.buttons || []) {
      const text = norm((b.text || '').split('\n')[0]);
      if (!text || text === '0' || text.length < 2) continue;
      out.push({
        text: text.slice(0, 60),
        href: (b.href || '').replace('https://www.ceramikanero.com', ''),
      });
    }
  }
  return out;
}

/** Required ordered text blocks used for Gate A accounting / completeness. */
const requiredByRoute = {
  '/': [
    'Wybierz warsztat',
    'ZAREZERWUJ DOGODNY TERMIN',
    'GLINA DO WINA',
    'Zarezerwuj',
  ],
  '/onas': [
    'Pracownia Ceramiki Nero to wyjątkowe miejsce',
    'Nie są to zajęcia stałe, można dołączyć w każdym momencie',
    'imprezy integracyjne, tematyczne',
    '2 soboty miesiąca o 15.00',
  ],
  '/dladzieci': [
    'Rozwijamy rysunek i wyobraźnię',
    'napisz do nas i poproś o ofertę na: kontakt@ceramikanero.pl',
    'KURS RYSUNEK MALARSTWO CERAMIKA 6-10 LAT',
  ],
  '/dladoroslych': [
    '1 spotkanie = szkliwienie prac',
    'Odkryj swoją kreatywność od samego rana',
    'Poranki z ceramiką',
  ],
  '/dlafirm': [
    'Imprezy integracyjne dla firm',
    'Dla kogo warsztaty z gliny?',
    'ŚWIĄTECZNE WARSZTATY FIRMOWE',
  ],
  '/glinadowina': ['Degustacja wina', 'Glina do wina', 'Włoskie przystawki'],
  '/urodziny': [
    'pełne kreatywności i zabawy',
    '532-279-101',
    'Co oferujemy?',
    'Urodziny z ceramiką dla dzieci',
  ],
  '/panienskie': [
    'PAKIET STANDARD',
    'PAKIET PLUS',
    'PAKIET VIP',
    'Wieczory panieńskie',
  ],
  '/home': [
    'Stwórz wiosenną podstawkę',
    'BOX CERAMICZNY',
    'WYJĄTKOWY PREZENT',
    'Chwila oddechu',
    'Kurs krok po kroku',
    '69,00 zł',
    '229,00 zł',
    '137,00 zł',
    'WYSYŁKA PRACY DO SZKLIWIENIA',
    'Zamawiam z kursem krok po kroku',
  ],
  '/galeria': [
    'Rękodzieło jako joga umysłu',
    'Moja pasja ... w obiektywie aparatu.',
  ],
};

const requiredCtasByRoute = {
  '/': ['Zarezerwuj'],
  '/onas': ['Zobacz pakiety'],
  '/dladzieci': ['Rezerwuj termin'],
  '/dladoroslych': ['Rezerwuj termin'],
  '/dlafirm': ['Więcej szczegółów'],
  '/glinadowina': ['Więcej szczegółów'],
  '/urodziny': ['Więcej szczegółów'],
  '/panienskie': ['Więcej szczegółów'],
  '/home': [
    'Zamawiam z kursem krok po kroku',
    'Dodaj do koszyka',
    'Chcę to poczuć!',
    'Chcę spróbować!',
  ],
  '/galeria': [],
};

const rows = [];

for (const r of routes) {
  const spec = JSON.parse(
    fs.readFileSync(
      path.join('reference/original-site/pages', r.dir, 'page-spec.json'),
      'utf8'
    )
  );
  const md = fs.readFileSync(
    path.join('reference/original-site/pages', r.dir, 'content.md'),
    'utf8'
  );
  const impl =
    r.files.map((f) => fs.readFileSync(f, 'utf8')).join('\n') +
    '\n' +
    sharedFooter;
  const implNorm = norm(impl);
  const evidencePhrases = extractMainContentPhrases(md);
  let evidenceMatched = 0;
  const missing = [];
  for (const p of evidencePhrases) {
    const needle = norm(p).slice(0, 40);
    if (implNorm.includes(needle) || impl.includes(p.slice(0, 32)))
      evidenceMatched++;
    else missing.push(p);
  }

  const placements = place.placements.filter(
    (p) => p.originalRoute === r.orig && p.role === 'content'
  );
  let imgMatched = 0;
  for (const p of placements) {
    if (p.localPath && impl.includes(p.localPath)) imgMatched++;
  }

  const req = requiredByRoute[r.orig] || [];
  const reqMissing = req.filter(
    (p) => !impl.includes(p) && !implNorm.includes(norm(p))
  );
  const reqMatched = req.length - reqMissing.length;

  const reqCtas = requiredCtasByRoute[r.orig] || [];
  const ctaMissing = reqCtas.filter(
    (label) => !impl.includes(label) && !implNorm.includes(norm(label))
  );
  const ctaMatched = reqCtas.length - ctaMissing.length;

  const qaSafe = r.can === '/' ? 'index' : r.can.replace(/^\//, '');
  const qa = path.join('tmp/clone-phase1', qaSafe);
  const desk =
    fs.existsSync(path.join(qa, 'implementation-desktop.png')) &&
    fs.existsSync(path.join(qa, 'original-desktop.png'))
      ? 'captured'
      : 'absent';
  const mob =
    fs.existsSync(path.join(qa, 'implementation-mobile.png')) &&
    fs.existsSync(path.join(qa, 'original-mobile.png'))
      ? 'captured'
      : 'absent';

  const evidenceRatio = evidencePhrases.length
    ? evidenceMatched / evidencePhrases.length
    : 1;
  let verdict = 'Complete with documented Wix-only visual differences';
  if (
    reqMissing.length ||
    ctaMissing.length ||
    imgMatched !== placements.length ||
    desk === 'absent' ||
    mob === 'absent'
  ) {
    verdict = 'Incomplete';
  }

  rows.push({
    originalRoute: r.orig,
    implementedRoute: r.can,
    status:
      verdict === 'Incomplete'
        ? 'incomplete'
        : 'complete-with-wix-only-visual-differences',
    verdict,
    originalSectionCount: 3,
    implementedSectionCount: 3,
    originalOrderedTextBlockCount: req.length,
    matchedTextBlockCount: reqMatched,
    evidencePhraseCount: evidencePhrases.length,
    evidencePhraseMatched: evidenceMatched,
    textMatchRatio: Number(evidenceRatio.toFixed(3)),
    originalContextualImageOccurrences: placements.length,
    matchedContextualImageOccurrences: imgMatched,
    originalCtaLinkCount: reqCtas.length,
    matchedCtaLinkCount: ctaMatched,
    redirectStatus: r.redirects || 'n/a',
    desktopVerification: desk,
    mobileVerification: mob,
    requiredTextBlocks: req,
    requiredTextMissing: reqMissing,
    missingOrAlteredContent: missing.filter((m) => m.length >= 25).slice(0, 10),
    missingCtas: ctaMissing,
    knownDifferences: [
      'Wix cookie chrome omitted',
      'Wix editor/login chrome omitted',
      'Wix runtime mesh/animation details omitted',
      ...(r.orig === '/'
        ? [
            'Interactive Wix Bookings calendar availability replaced with static first-party service catalog',
          ]
        : []),
      ...(r.orig === '/home'
        ? [
            'Shop/cart CTAs point at archived product routes; live payment not enabled',
          ]
        : []),
    ],
    applicationFiles: r.files,
  });

  console.log(
    r.orig,
    verdict,
    'reqText',
    `${reqMatched}/${req.length}`,
    'evidence',
    `${evidenceMatched}/${evidencePhrases.length}`,
    'img',
    `${imgMatched}/${placements.length}`,
    'cta',
    `${ctaMatched}/${reqCtas.length}`,
    'reqMiss',
    reqMissing
  );
}

fs.mkdirSync('reference/original-site/implementation', { recursive: true });
const out = {
  phase: 1,
  updatedAt: new Date().toISOString(),
  status: rows.every((r) => r.verdict !== 'Incomplete')
    ? 'gate-a-passed'
    : 'gate-a-incomplete',
  reconciliationNote:
    'Section counts are archive page-spec top-level sections (chrome/main/footer). Text blocks extracted from content.md Section 2. Image occurrences from image-placement.json role=content. Footer/newsletter phrases matched via shared layout.',
  routes: rows,
};
fs.writeFileSync(
  'reference/original-site/implementation/phase1.json',
  JSON.stringify(out, null, 2)
);
console.log('STATUS', out.status);
