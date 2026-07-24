'use strict';

/**
 * Extract Phase 2 clone fixtures from reference/original-site archive.
 * Generates TypeScript modules under lib/clone/content/phase2/
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pagesRoot = path.join(root, 'reference/original-site/pages');
const outRoot = path.join(root, 'lib/clone/content/phase2');
const place = JSON.parse(
  fs.readFileSync(
    path.join(root, 'reference/original-site/image-placement.json'),
    'utf8'
  )
);

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function rewriteHref(href) {
  if (!href) return href;
  let h = href.replace(/^https?:\/\/(www\.)?ceramikanero\.com/i, '');
  if (!h) h = '/';
  // block beauty spa / excluded
  if (
    /\/(about-2|forum|members|order-online|pricing-plans|refer-friends|referral|services-1|services\/(cosmetic|facial|foundations|manicure|skin))/i.test(
      h
    )
  ) {
    return '/';
  }
  if (/\/profile\//i.test(h)) return '/blog';
  return h;
}

function extractMainSections(md) {
  const parts = md.split(/^## Section /m).slice(1);
  const sections = [];
  for (const part of parts) {
    const firstLine = part.split('\n')[0] || '';
    const headingMatch = firstLine.match(/^\d+(?::\s*(.*))?$/);
    const heading =
      (headingMatch && headingMatch[1]) || firstLine.replace(/^\d+\s*/, '');
    const bodyLines = [];
    const images = [];
    const buttons = [];
    let mode = 'body';
    for (const raw of part.split(/\n/).slice(1)) {
      const line = raw.trimEnd();
      const t = line.trim();
      if (/^### Buttons/.test(t)) {
        mode = 'buttons';
        continue;
      }
      if (/^### Images/.test(t)) {
        mode = 'images';
        continue;
      }
      if (mode === 'buttons' && t.startsWith('- ')) {
        const m = t.match(/^-\s+(.+?)(?:\s+→\s+(\S+))?$/);
        if (m) {
          buttons.push({
            label: m[1].replace(/\s+/g, ' ').trim(),
            href: rewriteHref(m[2] || '#'),
          });
        }
        continue;
      }
      if (mode === 'images' && t.startsWith('- ')) {
        const bits = t
          .slice(2)
          .split('|')
          .map((s) => s.trim());
        images.push({
          alt: bits[0] || '',
          src: bits[1] || '',
          dims: bits[2] || '',
        });
        continue;
      }
      if (mode === 'body') bodyLines.push(line);
    }
    const text = bodyLines.join('\n').trim();
    if (
      (!text || text === '0') &&
      images.length === 0 &&
      buttons.every((b) => b.label === '0')
    ) {
      continue;
    }
    sections.push({
      heading: heading && heading !== '0' ? heading.trim() : null,
      text,
      images: images.filter((i) => i.src.startsWith('/images/')),
      buttons: buttons.filter((b) => b.label && b.label !== '0'),
    });
  }
  return sections;
}

function placementsForRoute(route) {
  return place.placements
    .filter(
      (p) => p.originalRoute === route && p.role === 'content' && p.localPath
    )
    .map((p) => ({
      src: p.localPath,
      alt: p.altText || '',
      sectionNumber: p.sectionNumber,
    }));
}

function loadPage(safeDir) {
  const base = path.join(pagesRoot, safeDir);
  const md = fs.readFileSync(path.join(base, 'content.md'), 'utf8');
  const spec = JSON.parse(
    fs.readFileSync(path.join(base, 'page-spec.json'), 'utf8')
  );
  const titleLine = md.split('\n')[0].replace(/^#\s*/, '').trim();
  return {
    title: spec.pageTitle || titleLine,
    route: spec.route,
    sections: extractMainSections(md),
    images: placementsForRoute(spec.route),
  };
}

function tsString(s) {
  return JSON.stringify(s ?? '');
}

function writeModule(filePath, exportName, data) {
  ensureDir(path.dirname(filePath));
  const body = `/* Auto-generated from reference/original-site — do not invent content. */\nexport const ${exportName} = ${JSON.stringify(data, null, 2)} as const;\n`;
  fs.writeFileSync(filePath, body);
}

// --- Blog posts ---
const postDirs = fs
  .readdirSync(path.join(pagesRoot, 'post'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const posts = [];
for (const slug of postDirs) {
  const page = loadPage(path.join('post', slug));
  const main = page.sections[0] || {
    text: '',
    images: [],
    buttons: [],
    heading: null,
  };
  // Parse date/author heuristics from text head
  const lines = main.text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  let author = 'Gosia Nero';
  let date = null;
  let readingTime = null;
  const bodyStart = lines.findIndex((l, i) => {
    if (/^\d{1,2} [a-ząćęłńóśźż]{3} \d{4}$/i.test(l)) {
      date = l;
      return false;
    }
    if (/minut/.test(l)) {
      readingTime = l;
      return false;
    }
    if (l === 'Gosia Nero' || l === 'Udostępnij post') return false;
    if (/^(Wszystkie|Aktualności|O mnie|Ciekawostki)$/.test(l)) return false;
    if (i < 8 && l === page.sections[0]?.heading) return false;
    return i > 3;
  });
  // Better: find first long paragraph after meta
  let started = false;
  const paragraphs = [];
  for (const l of lines) {
    if (
      /^(Udostępnij post|Wszystkie|Aktualności|O mnie|Ciekawostki|Gosia Nero)$/.test(
        l
      )
    )
      continue;
    if (/^\d{1,2} [a-ząćęłńóśźż]{3} \d{4}$/i.test(l)) {
      date = l;
      continue;
    }
    if (/minut/.test(l) && l.length < 40) {
      readingTime = l;
      continue;
    }
    if (l === main.heading) continue;
    if (
      /^(12 wyświetleń|0 komentarzy|Post nie został|Ostatnie posty|Zobacz wszystkie|Komentarze|Napisz komentarz)/i.test(
        l
      )
    )
      break;
    if (l.length < 2) continue;
    paragraphs.push(l);
    started = true;
  }

  posts.push({
    slug,
    route: `/post/${slug}`,
    title: main.heading || page.title,
    author,
    date,
    readingTime,
    paragraphs,
    images: main.images.length ? main.images : page.images.slice(0, 3),
    categoryHints: [],
  });
}

// Index order from blog content links
const blogIndex = loadPage('blog');
const indexOrder = [];
for (const b of blogIndex.sections.flatMap((s) => s.buttons)) {
  if (b.href.startsWith('/post/')) {
    const slug = decodeURIComponent(b.href.replace('/post/', ''));
    if (!indexOrder.includes(slug)) indexOrder.push(slug);
  }
}

writeModule(path.join(outRoot, 'blog-posts.ts'), 'archiveBlogPosts', {
  indexOrder,
  posts,
});

const categories = ['aktualności', 'ciekawostki', 'o-mnie'];
const categoryPages = {};
for (const cat of categories) {
  const dir = path.join('blog/categories', cat);
  if (!fs.existsSync(path.join(pagesRoot, dir))) continue;
  categoryPages[cat] = loadPage(dir);
}
writeModule(
  path.join(outRoot, 'blog-categories.ts'),
  'archiveBlogCategories',
  categoryPages
);

// Shop + legal + webinars + services — store as archive pages map
const phase2Dirs = [
  'sklep',
  'vouchery',
  'gift-card',
  'cart',
  'regulamin',
  'terms-conditions',
  'faq',
  'dostawy-i-zwroty',
  'kontakt',
  'services',
  'services/glina-do-wina',
  'courses',
  'webinar-registration',
  'webinar-registration-1',
  'webinar-registration-2',
  'webinar-registration-3',
  'webinar-registration-4',
];

const productDirs = fs.existsSync(path.join(pagesRoot, 'product-page'))
  ? fs
      .readdirSync(path.join(pagesRoot, 'product-page'), {
        withFileTypes: true,
      })
      .filter((d) => d.isDirectory())
      .map((d) => path.join('product-page', d.name))
  : [];

const serviceDirs = fs.existsSync(path.join(pagesRoot, 'service-page'))
  ? fs
      .readdirSync(path.join(pagesRoot, 'service-page'), {
        withFileTypes: true,
      })
      .filter((d) => d.isDirectory())
      .map((d) => path.join('service-page', d.name))
  : [];

const bookingDirs = fs.existsSync(path.join(pagesRoot, 'booking-calendar'))
  ? fs
      .readdirSync(path.join(pagesRoot, 'booking-calendar'), {
        withFileTypes: true,
      })
      .filter((d) => d.isDirectory())
      .map((d) => path.join('booking-calendar', d.name))
  : [];

const courseDirs = fs.existsSync(path.join(pagesRoot, 'courses'))
  ? fs
      .readdirSync(path.join(pagesRoot, 'courses'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join('courses', d.name))
  : [];

const eventDirs = [];
const eventRoot = path.join(pagesRoot, 'szczeg-y-wydarzenia-i-rejestracja');
if (fs.existsSync(eventRoot)) {
  for (const d of fs.readdirSync(eventRoot, { withFileTypes: true })) {
    if (d.isDirectory())
      eventDirs.push(path.join('szczeg-y-wydarzenia-i-rejestracja', d.name));
  }
}

const allDirs = [
  ...phase2Dirs,
  ...productDirs,
  ...serviceDirs,
  ...bookingDirs,
  ...courseDirs,
  ...eventDirs,
];

const archivePages = {};
for (const dir of allDirs) {
  const base = path.join(pagesRoot, dir);
  if (!fs.existsSync(path.join(base, 'content.md'))) continue;
  const page = loadPage(dir);
  archivePages[page.route] = page;
}

writeModule(
  path.join(outRoot, 'archive-pages.ts'),
  'archivePages',
  archivePages
);

console.log(
  JSON.stringify(
    {
      posts: posts.length,
      categories: Object.keys(categoryPages).length,
      archivePages: Object.keys(archivePages).length,
      indexOrder: indexOrder.length,
    },
    null,
    2
  )
);
