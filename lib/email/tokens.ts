/**
 * Brand tokens for Ceramika Nero transactional emails.
 * Inline-CSS friendly; no Tailwind / web-font reliance.
 */

export const emailColors = {
  cream: '#fdf2ed',
  paper: '#fbf7ef',
  text: '#4a2f28',
  muted: '#6b534c',
  accent: '#b85c45',
  sage: '#8a9a84',
  border: '#e8d9ce',
  white: '#ffffff',
  bannerSuccessBg: '#eef2ec',
  bannerWarningBg: '#f8ebe6',
  bannerInfoBg: '#f3ebe4',
  bannerDangerBg: '#f6e4e0',
} as const;

export const emailFonts = {
  /** Email-safe stack — Georgia for editorial warmth */
  heading: "Georgia, 'Times New Roman', Times, 'Liberation Serif', serif",
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

export const emailLayout = {
  maxWidth: 600,
  outerPadding: 24,
  cardPadding: 28,
  sectionGap: 20,
  radius: 4,
} as const;

export const EMAIL_BRAND_NAME = 'Ceramika Nero';
export const EMAIL_BRAND_FULL = 'Pracownia ceramiki Nero';

export const EMAIL_LOGO_PATH =
  '/images/wix-migrated/747d6f_64bcccd9911949e7895d7325e88a5a75.png';

export const EMAIL_FALLBACK_SITE_URL = 'https://ceramikanero.pl';
