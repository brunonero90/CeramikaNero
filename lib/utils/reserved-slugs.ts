/**
 * Slugs that cannot be used for dynamic content pages because they are
 * reserved by application routes.
 */
export const RESERVED_PAGE_SLUGS = new Set([
  'admin',
  'api',
  'warsztaty',
  'dla-dzieci',
  'dla-doroslych',
  'grupy-i-firmy',
  'pracownia',
  'kontakt',
  'blog',
  'galeria',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

export function isReservedPageSlug(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.has(slug.toLowerCase());
}
