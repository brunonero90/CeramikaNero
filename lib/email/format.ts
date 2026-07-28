import { formatGroszAsPln } from '@/lib/utils/money';
import { EMAIL_FALLBACK_SITE_URL, EMAIL_LOGO_PATH } from '@/lib/email/tokens';

export { formatGroszAsPln };

/** Polish date/time in Europe/Warsaw — same pattern as booking email templates. */
export function formatWarsawDate(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function isNetlifyAppHost(hostname: string): boolean {
  return (
    hostname === 'netlify.app' ||
    hostname.endsWith('.netlify.app') ||
    hostname.includes('netlify.app')
  );
}

/**
 * Absolute public site URL for emails.
 * Prefers NEXT_PUBLIC_SITE_URL but NEVER returns a netlify.app host.
 */
export function getEmailSiteUrl(override?: string | null): string {
  const candidates = [
    override,
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_SITE_URL
      : undefined,
    EMAIL_FALLBACK_SITE_URL,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(
        trimmed.includes('://') ? trimmed : `https://${trimmed}`
      );
      if (isNetlifyAppHost(url.hostname.toLowerCase())) continue;
      return url.origin.replace(/\/$/, '');
    } catch {
      continue;
    }
  }

  return EMAIL_FALLBACK_SITE_URL;
}

export function absoluteEmailUrl(
  path: string,
  siteUrl?: string | null
): string {
  const base = getEmailSiteUrl(siteUrl);
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (isNetlifyAppHost(u.hostname.toLowerCase())) {
        return `${base}${u.pathname}${u.search}${u.hash}`;
      }
      return path;
    } catch {
      return `${base}/${path.replace(/^\//, '')}`;
    }
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function emailLogoUrl(siteUrl?: string | null): string {
  return absoluteEmailUrl(EMAIL_LOGO_PATH, siteUrl);
}

/** Group a Polish NRB / IBAN for readable display (XX XXXX XXXX …). */
export function formatBankAccountGrouped(account: string): string {
  const compact = account.replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{26}$/.test(compact) && !/^PL\d{26}$/.test(compact)) {
    return account.trim();
  }
  const digits = compact.startsWith('PL') ? compact.slice(2) : compact;
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 6),
    digits.slice(6, 10),
    digits.slice(10, 14),
    digits.slice(14, 18),
    digits.slice(18, 22),
    digits.slice(22, 26),
  ];
  return compact.startsWith('PL') ? `PL ${parts.join(' ')}` : parts.join(' ');
}

export function formatMoneyPln(grosz: number): string {
  return formatGroszAsPln(grosz);
}
