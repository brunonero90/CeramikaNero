import type { HomepageVenueKey } from '@/lib/clone/content/landings';

/** Normalized venue keys used for filtering and session metadata. */
export const VENUE_KEYS = {
  SUCHY_LAS: 'suchy-las',
  PTASIE_RADIO: 'ptasie-radio',
} as const;

export type SessionVenueKey =
  (typeof VENUE_KEYS)[keyof typeof VENUE_KEYS] | 'other';

export const VENUE_LABELS: Record<SessionVenueKey, string> = {
  'suchy-las': 'Ceramika Nero, ul. Podgórna 3, Suchy Las',
  'ptasie-radio': 'Ptasie Radio, ul. Kościuszki 74/3, Poznań',
  other: 'Inna lokalizacja',
};

/**
 * Infer venue key for CMS/legacy cards that lack an explicit venueKey.
 * Prefer explicit venueKey on source data; use this only as a fallback.
 */
export function inferHomepageVenueKey(input: {
  venueKey?: string | null;
  href?: string | null;
  moreHref?: string | null;
  title?: string | null;
}): HomepageVenueKey {
  if (
    input.venueKey === 'suchy-las' ||
    input.venueKey === 'ptasie-radio' ||
    input.venueKey === 'enquiry'
  ) {
    return input.venueKey;
  }
  const hay = `${input.href ?? ''} ${input.moreHref ?? ''}`.toLowerCase();
  if (hay.includes('ptasim-radiu') || hay.includes('ptasie-radio')) {
    return 'ptasie-radio';
  }
  if (
    hay.includes('/kontakt') ||
    hay.startsWith('mailto:') ||
    (input.href ?? '').includes('oferta=')
  ) {
    return 'enquiry';
  }
  return 'suchy-las';
}
