'use strict';

/**
 * Closure Step 1–3: compare legacy-copy and profile routes to candidates.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = process.cwd();
const pagesRoot = path.join(root, 'reference/original-site/pages');

function norm(s) {
  return String(s || '')
    .replace(/[\u00a0\u200b]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhrases(md) {
  const parts = md.split(/^## Section /m).slice(1);
  let best = [];
  for (const part of parts) {
    const phrases = [];
    for (const raw of part.split(/\n+/)) {
      let line = raw.trim();
      if (!line) continue;
      if (/^#+|^### |^- Original|^Images$|^Buttons/.test(line)) continue;
      if (/^-\s+.+\s+→/.test(line)) continue;
      if (line.includes('/images/') && line.includes('|')) continue;
      line = line.replace(/^[-*■]\s+/, '').replace(/^■\s*/, '');
      const n = norm(line);
      if (n.length < 18 || n.length > 220) continue;
      if (/^https?:|^\d+$|^0$/.test(n)) continue;
      if (/cookie|wix|Numer Konta|Newsletter|Akceptuję regulamin/i.test(n))
        continue;
      phrases.push(n);
    }
    if (phrases.length > best.length) best = [...new Set(phrases)];
  }
  return best;
}

function extractImages(md) {
  const imgs = [];
  for (const line of md.split(/\n+/)) {
    const m = line.match(/\/images\/wix-migrated\/[A-Za-z0-9_.-]+/);
    if (m) imgs.push(m[0]);
  }
  return [...new Set(imgs)];
}

function extractButtons(md) {
  const buttons = [];
  for (const line of md.split(/\n+/)) {
    const m = line.match(/^-\s+(.+?)\s+→\s+(\S+)/);
    if (!m) continue;
    const label = norm(m[1].split('\n')[0]).slice(0, 80);
    if (!label || label === '0') continue;
    buttons.push({
      label,
      href: m[2].replace('https://www.ceramikanero.com', ''),
    });
  }
  return buttons;
}

function load(dir) {
  const base = path.join(pagesRoot, dir);
  const md = fs.readFileSync(path.join(base, 'content.md'), 'utf8');
  const spec = JSON.parse(
    fs.readFileSync(path.join(base, 'page-spec.json'), 'utf8')
  );
  return {
    dir,
    route: spec.route,
    title: spec.pageTitle || '',
    sectionCount: (spec.sections || []).length,
    phrases: extractPhrases(md),
    images: extractImages(md),
    buttons: extractButtons(md),
    mdHash: crypto.createHash('sha1').update(md).digest('hex').slice(0, 12),
    textBlob: norm(md),
  };
}

function compare(a, b) {
  const aSet = new Set(a.phrases);
  const bSet = new Set(b.phrases);
  const onlyA = a.phrases.filter(
    (p) => !bSet.has(p) && !b.textBlob.includes(p.slice(0, 40))
  );
  const onlyB = b.phrases.filter(
    (p) => !aSet.has(p) && !a.textBlob.includes(p.slice(0, 40))
  );
  const shared = a.phrases.filter(
    (p) => bSet.has(p) || b.textBlob.includes(p.slice(0, 40))
  );
  const imgOnlyA = a.images.filter((i) => !b.images.includes(i));
  const imgOnlyB = b.images.filter((i) => !a.images.includes(i));
  const imgShared = a.images.filter((i) => b.images.includes(i));
  const ratio =
    a.phrases.length === 0 ? 1 : shared.length / Math.max(a.phrases.length, 1);
  return {
    textShared: shared.length,
    textOnlySource: onlyA.length,
    textOnlyTarget: onlyB.length,
    textMatchRatio: Number(ratio.toFixed(3)),
    uniqueSourceSample: onlyA.slice(0, 12),
    uniqueTargetSample: onlyB.slice(0, 8),
    imgShared: imgShared.length,
    imgOnlySource: imgOnlyA,
    imgOnlyTarget: imgOnlyB.slice(0, 8),
    sectionCountSource: a.sectionCount,
    sectionCountTarget: b.sectionCount,
    exactMdHashEqual: a.mdHash === b.mdHash,
  };
}

const pairs = [
  {
    source: 'copy-of-panieński-opis',
    candidates: ['panienskie', 'glinadowina', 'webinar-registration'],
  },
  {
    source: 'kopia-panieński-plus-opis',
    candidates: ['panienskie', 'webinar-registration-1', 'glinadowina'],
  },
  {
    source: 'kopia-urodziny-ceramika',
    candidates: ['urodziny', 'glinadowina'],
  },
];

const matrix = [];
for (const pair of pairs) {
  const source = load(pair.source);
  const comparisons = pair.candidates.map((c) => {
    const target = load(c);
    return { candidate: target.route, dir: c, ...compare(source, target) };
  });
  comparisons.sort((a, b) => b.textMatchRatio - a.textMatchRatio);
  matrix.push({
    originalRoute: source.route,
    archiveDir: pair.source,
    title: source.title,
    phraseCount: source.phrases.length,
    imageCount: source.images.length,
    buttonCount: source.buttons.length,
    best: comparisons[0],
    all: comparisons,
  });
}

const profiles = [
  'profile/gosianowicka/profile',
  'profile/gosianowicka/events',
  'profile/gosianowicka/forum-posts',
  'profile/gosianowicka/forum-comments',
];

const profileReports = profiles.map((dir) => {
  const page = load(dir);
  const md = fs.readFileSync(path.join(pagesRoot, dir, 'content.md'), 'utf8');
  const rawExists = fs.existsSync(path.join(pagesRoot, dir, 'raw.html'));
  const rendered = fs.existsSync(path.join(pagesRoot, dir, 'rendered.html'))
    ? fs.readFileSync(path.join(pagesRoot, dir, 'rendered.html'), 'utf8')
    : '';
  const signals = {
    hasLogin: /log\s*in|zaloguj|members|wix.?members|sign.?in/i.test(
      md + rendered
    ),
    hasForum: /forum|komentarz|comment/i.test(md),
    hasEvents: /wydarzen|events|nadchodz/i.test(md),
    hasBio: /Małgosia|Nero|pasjonatk|ceramik/i.test(md),
    mentionsFollowers: /obserwuj|follow|followers|człon/i.test(md),
    wixIdentity: /wixstatic|parastorage|members-area|wix-code/i.test(
      rendered.slice(0, 50000)
    ),
  };
  return {
    route: page.route,
    title: page.title,
    phraseCount: page.phrases.length,
    imageCount: page.images.length,
    phrasesSample: page.phrases.slice(0, 15),
    buttonsSample: page.buttons.slice(0, 10),
    signals,
    rawExists,
  };
});

const out = {
  generatedAt: new Date().toISOString(),
  legacy: matrix,
  profiles: profileReports,
};
fs.mkdirSync('tmp/clone-closure', { recursive: true });
fs.writeFileSync(
  'tmp/clone-closure/step1-comparison.json',
  JSON.stringify(out, null, 2)
);

for (const row of matrix) {
  console.log('\n===', row.originalRoute, '===');
  console.log('phrases', row.phraseCount, 'images', row.imageCount);
  for (const c of row.all) {
    console.log(
      ' vs',
      c.candidate,
      'ratio',
      c.textMatchRatio,
      'shared',
      c.textShared,
      'onlySrc',
      c.textOnlySource,
      'imgShared',
      c.imgShared,
      'imgOnlySrc',
      c.imgOnlySource.length
    );
    if (c.uniqueSourceSample.length)
      console.log('  unique:', c.uniqueSourceSample.slice(0, 5));
  }
}

console.log('\n=== PROFILES ===');
for (const p of profileReports) {
  console.log(
    p.route,
    'phrases',
    p.phraseCount,
    'imgs',
    p.imageCount,
    p.signals
  );
  console.log(' sample', p.phrasesSample.slice(0, 6));
}
