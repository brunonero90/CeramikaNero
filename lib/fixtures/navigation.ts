import { NavItem } from '@/lib/types/navigation';

/**
 * Primary marketing navigation matching archived Wix menu labels/order
 * (from raw.html linkElement capture on /, /urodziny, /onas).
 * Destinations use Phase 1 canonical routes.
 */
export const primaryNavigation: NavItem[] = [
  { label: 'O nas', href: '/pracownia' },
  { label: 'Zapisy', href: '/kalendarz' },
  { label: 'Dla dzieci', href: '/dla-dzieci' },
  { label: 'Dla dorosłych', href: '/dla-doroslych' },
  { label: 'GLINA BOX', href: '/home' },
  { label: 'Glina do wina', href: '/glinadowina' },
  { label: 'Urodziny', href: '/urodziny' },
  { label: 'Dla firm', href: '/grupy-i-firmy' },
  { label: 'Panieńskie', href: '/panienskie' },
  { label: 'Galeria', href: '/galeria' },
  { label: 'Kontakt', href: '/kontakt' },
  { label: 'Blog', href: '/blog' },
];

export const siteContact = {
  brand: 'Pracownia ceramiki Nero',
  addressLine: 'ul. Podgórna 3',
  cityLine: 'Suchy Las 62-002',
  email: 'nerogosia@gmail.com',
  phoneDisplay: '532 279 101',
  phoneHref: 'tel:+48532279101',
  bankAccount: '30 1140 2004 0000 3102 8314 9467',
  nip: '9721134965',
  facebookUrl: 'https://www.facebook.com/ceramikanero',
  instagramUrl: 'https://www.instagram.com/ceramika_nero',
  privacyHref: '/polityka-prywatnosci',
} as const;
