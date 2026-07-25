import { existsSync, readFileSync } from 'fs';
import path from 'path';

type PageSpecSection = {
  headings?: string[];
  heading?: string | null;
  text?: string;
};

type PageSpec = {
  route: string;
  sections: PageSpecSection[];
};

const cache = new Map<string, PageSpec | null>();

function routeCandidates(route: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };
  add(route);
  try {
    add(decodeURIComponent(route));
  } catch {
    // ignore
  }
  for (const value of [...out]) {
    add(value.normalize('NFC'));
    add(value.normalize('NFD'));
  }
  return out;
}

function pageSpecPathForRoute(route: string): string | null {
  const root = path.join(process.cwd(), 'reference', 'original-site', 'pages');
  for (const r of routeCandidates(route)) {
    const rel = r === '/' ? 'index' : r.replace(/^\//, '');
    const candidates = [
      path.join(root, rel, 'page-spec.json'),
      path.join(
        root,
        rel
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/ł/gi, 'l'),
        'page-spec.json'
      ),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function loadPageSpec(route: string): PageSpec | null {
  if (cache.has(route)) return cache.get(route) ?? null;
  const file = pageSpecPathForRoute(route);
  if (!file) {
    cache.set(route, null);
    return null;
  }
  try {
    const spec = JSON.parse(readFileSync(file, 'utf8')) as PageSpec;
    cache.set(route, spec);
    return spec;
  } catch {
    cache.set(route, null);
    return null;
  }
}

/**
 * Return archived heading strings for a content section index.
 * Filters out newsletter/admin privacy blobs that are not page body headings.
 */
export function knownHeadingsForSection(
  route: string,
  sectionIndex: number
): string[] {
  const spec = loadPageSpec(route);
  if (!spec?.sections?.[sectionIndex]) return [];
  const section = spec.sections[sectionIndex]!;
  const raw = [
    ...(section.heading ? [section.heading] : []),
    ...(section.headings ?? []),
  ];
  return raw.filter((h) => {
    const t = h.replace(/\s+/g, ' ').trim();
    if (t.length < 2) return false;
    if (/zapisz się do newslettera/i.test(t)) return false;
    if (/administratorem twoich danych/i.test(t)) return false;
    if (/polityce prywatności/i.test(t) && t.length > 80) return false;
    return true;
  });
}
