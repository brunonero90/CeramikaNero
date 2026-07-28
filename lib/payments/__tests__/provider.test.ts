import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getPaymentsProviderMode,
  resolveCheckoutPaymentMethod,
  shouldCreateStripeCheckoutNow,
} from '@/lib/payments/provider';

describe('payments provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to manual', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', undefined);
    expect(getPaymentsProviderMode()).toBe('manual');
  });

  it('resolves stripe mode only when configured', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', 'stripe');
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const missing = resolveCheckoutPaymentMethod({
      shippingQuoteRequired: false,
    });
    expect(missing.ok).toBe(false);

    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    const ok = resolveCheckoutPaymentMethod({ shippingQuoteRequired: false });
    expect(ok).toEqual({ ok: true, method: 'stripe' });
  });

  it('requires explicit choice in both mode', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', 'both');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    const missing = resolveCheckoutPaymentMethod({
      shippingQuoteRequired: false,
    });
    expect(missing.ok).toBe(false);

    const bank = resolveCheckoutPaymentMethod({
      requested: 'bank_transfer',
      shippingQuoteRequired: false,
    });
    expect(bank).toEqual({ ok: true, method: 'bank_transfer' });
  });

  it('does not create checkout while shipping quote pending', () => {
    vi.stubEnv('PAYMENTS_PROVIDER', 'stripe');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    expect(
      shouldCreateStripeCheckoutNow({
        method: 'stripe',
        shippingQuoteRequired: true,
        totalGrossGrosz: 14900,
      })
    ).toBe(false);
    expect(
      shouldCreateStripeCheckoutNow({
        method: 'stripe',
        shippingQuoteRequired: false,
        totalGrossGrosz: 14900,
      })
    ).toBe(true);
  });
});
