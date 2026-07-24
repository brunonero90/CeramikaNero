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
  'glinadowina',
  'urodziny',
  'panienskie',
  'home',
  'onas',
  'dladzieci',
  'dladoroslych',
  'dlafirm',
  'sklep',
  'cart',
  'vouchery',
  'gift-card',
  'regulamin',
  'terms-conditions',
  'faq',
  'dostawy-i-zwroty',
  'services',
  'courses',
  'post',
  'product-page',
  'service-page',
  'booking-calendar',
  'webinar-registration',
  'webinar-registration-1',
  'webinar-registration-2',
  'webinar-registration-3',
  'webinar-registration-4',
  'szczeg-y-wydarzenia-i-rejestracja',
  '_next',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
]);

export function isReservedPageSlug(slug: string): boolean {
  return RESERVED_PAGE_SLUGS.has(slug.toLowerCase());
}
