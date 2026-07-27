/**
 * Staging / secondary-host indexing control.
 * ceramikanero.pl is used for Resend + cutover testing while ceramikanero.com
 * remains the SEO-primary domain. Disallow indexing on .pl unless explicitly
 * enabled with SITE_ALLOW_INDEXING=1.
 */
export function shouldDisallowPublicIndexing(): boolean {
  if (process.env.SITE_NOINDEX === '1') return true;
  if (process.env.SITE_ALLOW_INDEXING === '1') return false;

  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === 'ceramikanero.pl' || host === 'www.ceramikanero.pl';
  } catch {
    return false;
  }
}
