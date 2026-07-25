/**
 * Netlify scheduled function: release unpaid booking holds.
 * Schedule is declared in netlify.toml.
 */
exports.handler = async () => {
  const secret = process.env.BOOKING_CRON_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !siteUrl) {
    console.error(
      '[booking-expiry] Missing BOOKING_CRON_SECRET or NEXT_PUBLIC_SITE_URL'
    );
    return { statusCode: 500, body: 'Misconfigured' };
  }

  const url = new URL('/api/cron/expiry', siteUrl);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });
  const body = await response.text();
  console.info('[booking-expiry]', response.status, body.slice(0, 500));
  return { statusCode: response.status, body };
};
