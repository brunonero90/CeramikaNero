import { afterEach, describe, expect, it, vi } from 'vitest';

describe('buildCheckoutUrls', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('builds success/cancel URLs from NEXT_PUBLIC_SITE_URL without confirming payment', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl');
    const { buildCheckoutUrls } = await import('../urls');
    const urls = buildCheckoutUrls('CN-REF');

    expect(urls.successUrl).toBe(
      'https://ceramikanero.pl/rezerwacja/sukces?reference=CN-REF&session_id={CHECKOUT_SESSION_ID}'
    );
    expect(urls.cancelUrl).toBe(
      'https://ceramikanero.pl/rezerwacja/anulowana?reference=CN-REF'
    );
    expect(urls.successUrl).not.toMatch(/confirmed|paid|status=/);
  });
});
