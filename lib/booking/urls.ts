import 'server-only';

function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SITE_URL is not configured');
  }
  return url.replace(/\/$/, '');
}

export function buildCheckoutUrls(reference: string) {
  const siteUrl = getSiteUrl();
  return {
    successUrl: `${siteUrl}/rezerwacja/sukces?reference=${encodeURIComponent(reference)}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${siteUrl}/rezerwacja/anulowana?reference=${encodeURIComponent(reference)}`,
  };
}

export function buildCancellationUrl(token: string, reference: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/rezerwacja/anulowanie?reference=${encodeURIComponent(reference)}&token=${encodeURIComponent(token)}`;
}

export function buildBookingStatusUrl(reference: string): string {
  const siteUrl = getSiteUrl();
  return `${siteUrl}/rezerwacja/[reference]/platnosc?reference=${encodeURIComponent(reference)}`.replace(
    '[reference]',
    reference
  );
}
