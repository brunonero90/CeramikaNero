/**
 * Map public routes ↔ content_pages.slug.
 * Slugs must match /^[a-z0-9]+(-[a-z0-9]+)*$/ (no unicode, no slashes).
 */
const PL: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Ą: 'a',
  Ć: 'c',
  Ę: 'e',
  Ł: 'l',
  Ń: 'n',
  Ó: 'o',
  Ś: 's',
  Ź: 'z',
  Ż: 'z',
};

function asciiFold(input: string): string {
  return input
    .split('')
    .map((ch) => PL[ch] ?? ch)
    .join('')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function cmsSlugFromRoute(route: string): string {
  const path = route === '/' ? 'root' : route.replace(/^\//, '');
  return asciiFold(path)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function documentMatchesSlug(
  doc: { route: string; cmsSlug?: string },
  slug: string
): boolean {
  if (doc.cmsSlug && doc.cmsSlug === slug) return true;
  if (cmsSlugFromRoute(doc.route) === slug) return true;
  if (doc.route.replace(/^\//, '') === slug) return true;
  if (slug === 'root' && doc.route === '/') return true;
  return false;
}
