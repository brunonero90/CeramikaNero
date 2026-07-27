import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createMock = vi.fn();
const refundsCreateMock = vi.fn();

vi.mock('@/lib/stripe/server', () => ({
  getStripeServerClient: () => ({
    checkout: { sessions: { create: createMock } },
    refunds: { create: refundsCreateMock },
  }),
}));

describe('createStripeCheckoutSession', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.test',
    });
    refundsCreateMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('creates Checkout with server amount, PLN, booking metadata and no payment_method_types', async () => {
    const { createStripeCheckoutSession } = await import('../payment');

    await createStripeCheckoutSession({
      paymentId: 'pay_1',
      bookingId: 'book_1',
      reference: 'CN-ABC123',
      totalGrosz: 25000,
      currency: 'PLN',
      lineItemName: 'Toczenie',
      lineItemDescription: '2 uczestników',
      customerEmail: 'guest@example.com',
      successUrl:
        'https://ceramikanero.pl/rezerwacja/sukces?reference=CN-ABC123',
      cancelUrl:
        'https://ceramikanero.pl/rezerwacja/anulowana?reference=CN-ABC123',
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const [params, opts] = createMock.mock.calls[0] as [
      Record<string, unknown>,
      { idempotencyKey: string },
    ];

    expect(opts.idempotencyKey).toBe('checkout-pay_1');
    expect(params).not.toHaveProperty('payment_method_types');
    expect(params.mode).toBe('payment');
    expect(params.client_reference_id).toBe('CN-ABC123');
    expect(params.metadata).toEqual({
      booking_id: 'book_1',
      booking_reference: 'CN-ABC123',
      payment_id: 'pay_1',
    });
    expect(params.payment_intent_data).toEqual({
      metadata: {
        booking_id: 'book_1',
        booking_reference: 'CN-ABC123',
        payment_id: 'pay_1',
      },
    });
    expect(params.metadata).not.toHaveProperty('email');
    expect(params.metadata).not.toHaveProperty('customer_email');

    const lineItems = params.line_items as Array<{
      price_data: { currency: string; unit_amount: number };
      quantity: number;
    }>;
    expect(lineItems[0].price_data.currency).toBe('pln');
    expect(lineItems[0].price_data.unit_amount).toBe(25000);
    expect(lineItems[0].quantity).toBe(1);
    expect(params.success_url).toContain('https://ceramikanero.pl/');
    expect(params.cancel_url).toContain('https://ceramikanero.pl/');
  });

  it('does not record a successful refund when Stripe refunds.create throws', async () => {
    refundsCreateMock.mockRejectedValue(new Error('refund declined'));
    const { createStripeRefund } = await import('../payment');

    await expect(
      createStripeRefund({
        paymentId: 'pay_1',
        paymentIntentId: 'pi_1',
        amountGrosz: 1000,
        reason: 'test',
        idempotencyKey: 'refund-pay_1',
      })
    ).rejects.toThrow(/refund declined/);

    expect(refundsCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe('isStripeConfigured', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('requires only STRIPE_SECRET_KEY for hosted Checkout', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_x');
    vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', '');
    const { isStripeConfigured } = await import('../local-mode');
    expect(isStripeConfigured()).toBe(true);
  });

  it('is false without the secret key', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const { isStripeConfigured } = await import('../local-mode');
    expect(isStripeConfigured()).toBe(false);
  });
});
