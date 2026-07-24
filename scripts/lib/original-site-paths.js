'use strict';

const path = require('path');

const ORIGIN = 'https://www.ceramikanero.com';
const ROOT = path.join(process.cwd(), 'reference', 'original-site');

/** Map known original routes → new Next.js routes (best-effort). */
const NEW_ROUTE_MAP = {
  '/': '/',
  '/home': '/',
  '/onas': '/pracownia',
  '/dladzieci': '/dla-dzieci',
  '/dladoroslych': '/dla-doroslych',
  '/dlafirm': '/grupy-i-firmy',
  '/galeria': '/galeria',
  '/kontakt': '/kontakt',
  '/blog': '/blog',
  '/warsztaty': '/warsztaty',
  '/glinadowina': '/warsztaty',
  '/urodziny': '/warsztaty',
  '/panienskie': '/warsztaty',
  '/sklep': null,
  '/cart': null,
  '/regulamin': null,
  '/terms-conditions': null,
  '/faq': null,
  '/dostawy-i-zwroty': null,
  '/vouchery': null,
  '/gift-card': null,
  '/courses': '/warsztaty',
  '/services': '/warsztaty',
};

const EXCLUDE_EXACT = new Set([
  '/services/manicure',
  '/services/skin-product-consultation',
  '/services/cosmetic-laser',
  '/services/foundations-workshop',
  '/services/facial',
  '/about-2',
  '/pricing-plans/list',
  '/members',
  '/forum',
  '/refer-friends',
  '/referral',
  '/order-online',
  '/services-1',
]);

const EXCLUDE_PREFIXES = [
  '/_partials',
  '/pro-gallery-webapp',
  '/account/',
  '/wix-',
];

function normalizeUrl(input) {
  try {
    const u = new URL(input, ORIGIN);
    if (!u.hostname.replace(/^www\./, '').endsWith('ceramikanero.com')) {
      return null;
    }
    u.hash = '';
    u.protocol = 'https:';
    u.hostname = 'www.ceramikanero.com';
    // Drop tracking/lightbox query noise; keep meaningful pagination if any
    const drop = [
      'fbclid',
      'gclid',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'lightbox',
    ];
    for (const key of drop) u.searchParams.delete(key);
    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    u.pathname = pathname || '/';
    // Prefer decoded path for inventory identity, but keep href encoded for fetch
    return {
      href: u.href,
      pathname: u.pathname,
      search: u.search,
      canonicalHref: u.origin + u.pathname + (u.search ? u.search : ''),
    };
  } catch {
    return null;
  }
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** Filesystem-safe route directory under pages/ */
function toSafeRoute(pathname) {
  const decoded = decodePathname(pathname);
  if (!decoded || decoded === '/') return 'index';
  return decoded
    .replace(/^\//, '')
    .split('/')
    .map((seg) =>
      seg
        .replace(/[<>:"|?*\\]/g, '_')
        .replace(/\s+/g, '-')
        .slice(0, 120)
    )
    .join('/');
}

function classifyUrl(pathnameDecoded) {
  const p = pathnameDecoded.toLowerCase();
  if (EXCLUDE_EXACT.has(pathnameDecoded) || EXCLUDE_EXACT.has(p)) {
    return {
      include: false,
      classification: 'excluded-wix-template-or-system',
      reason: 'Wix Beauty Spa template leftover or system/auth route.',
    };
  }
  for (const prefix of EXCLUDE_PREFIXES) {
    if (p.startsWith(prefix)) {
      return {
        include: false,
        classification: 'excluded-wix-platform',
        reason: `Matches excluded platform prefix ${prefix}`,
      };
    }
  }
  if (
    p.startsWith('/profile/') &&
    /forum-|events$|forum-posts|forum-comments/.test(p)
  ) {
    return {
      include: true,
      classification: 'included-author-profile-surface',
      reason:
        'Author profile sub-surface linked from blog; captured for completeness.',
      pageType: 'profile',
    };
  }
  if (p === '/profile/gosianowicka/profile' || p.startsWith('/profile/')) {
    return {
      include: true,
      classification: 'included-author-profile',
      reason: 'Public author profile linked from blog.',
      pageType: 'profile',
    };
  }
  if (p.startsWith('/post/')) {
    return {
      include: true,
      classification: 'included-blog-post',
      reason: 'Blog post from sitemap/crawl.',
      pageType: 'blog-post',
    };
  }
  if (p.startsWith('/blog/categories/')) {
    return {
      include: true,
      classification: 'included-blog-category',
      reason: 'Blog category listing.',
      pageType: 'blog-category',
    };
  }
  if (p.startsWith('/service-page/') || p.startsWith('/booking-calendar/')) {
    return {
      include: true,
      classification: 'included-booking-service',
      reason: 'Workshop booking/service page.',
      pageType: p.startsWith('/booking-calendar/')
        ? 'booking-calendar'
        : 'service-page',
    };
  }
  if (p.startsWith('/product-page/')) {
    return {
      include: true,
      classification: 'included-product',
      reason: 'Store product page.',
      pageType: 'product',
    };
  }
  if (p.startsWith('/courses')) {
    return {
      include: true,
      classification: 'included-course',
      reason: 'Wix Courses surface with Ceramika workshop offerings.',
      pageType: 'course',
    };
  }
  if (p.startsWith('/webinar-registration')) {
    return {
      include: true,
      classification: 'included-webinar',
      reason: 'Webinar registration page.',
      pageType: 'webinar',
    };
  }
  if (
    p.startsWith('/kopia-') ||
    p.startsWith('/copy-of-') ||
    p.includes('panie')
  ) {
    return {
      include: true,
      classification: 'included-legacy-copy-page',
      reason: 'Legacy/copy page still published on original site.',
      pageType: 'marketing',
    };
  }
  if (p.startsWith('/szczeg')) {
    return {
      include: true,
      classification: 'included-event',
      reason: 'Event registration detail page.',
      pageType: 'event',
    };
  }

  const staticTypes = {
    '/': 'home',
    '/home': 'home-alias',
    '/onas': 'about',
    '/dladzieci': 'audience',
    '/dladoroslych': 'audience',
    '/dlafirm': 'audience',
    '/glinadowina': 'workshop-landing',
    '/urodziny': 'workshop-landing',
    '/panienskie': 'workshop-landing',
    '/galeria': 'gallery',
    '/kontakt': 'contact',
    '/blog': 'blog-index',
    '/warsztaty': 'workshops-index',
    '/sklep': 'shop',
    '/cart': 'cart',
    '/regulamin': 'legal',
    '/terms-conditions': 'legal',
    '/faq': 'faq',
    '/dostawy-i-zwroty': 'legal',
    '/vouchery': 'shop',
    '/gift-card': 'shop',
    '/services': 'services-index',
    '/services/glina-do-wina': 'service-alias',
  };

  if (staticTypes[pathnameDecoded] || staticTypes[p]) {
    return {
      include: true,
      classification: 'included-marketing',
      reason: 'Primary Ceramika Nero marketing or content page.',
      pageType: staticTypes[pathnameDecoded] || staticTypes[p],
    };
  }

  return {
    include: true,
    classification: 'included-discovered',
    reason: 'Discovered via sitemap, navigation, or in-page links.',
    pageType: 'other',
  };
}

function mapNewRoute(pathnameDecoded) {
  if (NEW_ROUTE_MAP[pathnameDecoded] !== undefined) {
    return NEW_ROUTE_MAP[pathnameDecoded];
  }
  if (pathnameDecoded.startsWith('/post/')) {
    const slug = pathnameDecoded.slice('/post/'.length);
    return `/blog/${slug}`;
  }
  if (pathnameDecoded.startsWith('/service-page/')) {
    const slug = pathnameDecoded.slice('/service-page/'.length);
    return `/warsztaty/${slug}`;
  }
  if (pathnameDecoded.startsWith('/booking-calendar/')) {
    const slug = pathnameDecoded.slice('/booking-calendar/'.length);
    return `/warsztaty/${slug}/rezerwacja`;
  }
  if (pathnameDecoded.startsWith('/courses/')) {
    return '/warsztaty';
  }
  if (pathnameDecoded.startsWith('/blog/categories/')) {
    return '/blog';
  }
  return null;
}

function extractWixMediaId(url) {
  if (!url) return null;
  const m = String(url).match(
    /(?:static\.wixstatic\.com\/media\/|wixstatic\.com\/media\/)([a-z0-9_]+)(?:~|\.|\/|$)/i
  );
  if (m) return m[1];
  const m2 = String(url).match(/\/([a-f0-9]{32}|[a-z0-9]+_[a-f0-9]{32})/i);
  return m2 ? m2[1] : null;
}

module.exports = {
  ORIGIN,
  ROOT,
  NEW_ROUTE_MAP,
  normalizeUrl,
  decodePathname,
  toSafeRoute,
  classifyUrl,
  mapNewRoute,
  extractWixMediaId,
};
