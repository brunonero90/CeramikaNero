import { describe, expect, it } from 'vitest';

/**
 * Pure eligibility rules mirroring derivePaymentFlags / checkout guards.
 * Kept free of Supabase so the BLIK regression matrix stays fast and stable.
 */
function canStartStripePayment(input: {
  shippingQuoteRequired: boolean;
  paymentStatus: string;
  orderStatus: string;
  selectedPaymentMethod: string | null;
  paymentReconciling: boolean;
}): boolean {
  const terminal =
    input.orderStatus === 'cancelled' ||
    input.orderStatus === 'expired' ||
    input.orderStatus === 'refunded';
  return (
    !input.shippingQuoteRequired &&
    input.paymentStatus !== 'paid' &&
    !terminal &&
    !input.paymentReconciling &&
    (input.selectedPaymentMethod === 'stripe' ||
      input.paymentStatus === 'failed')
  );
}

describe('CN-O Stripe pay eligibility (BLIK regression matrix)', () => {
  it('hides pay CTA when paid', () => {
    expect(
      canStartStripePayment({
        shippingQuoteRequired: false,
        paymentStatus: 'paid',
        orderStatus: 'confirmed',
        selectedPaymentMethod: 'stripe',
        paymentReconciling: false,
      })
    ).toBe(false);
  });

  it('hides pay CTA while reconciling after Stripe success', () => {
    expect(
      canStartStripePayment({
        shippingQuoteRequired: false,
        paymentStatus: 'pending',
        orderStatus: 'awaiting_payment',
        selectedPaymentMethod: 'stripe',
        paymentReconciling: true,
      })
    ).toBe(false);
  });

  it('allows retry after failed/expired eligible attempt', () => {
    expect(
      canStartStripePayment({
        shippingQuoteRequired: false,
        paymentStatus: 'failed',
        orderStatus: 'awaiting_payment',
        selectedPaymentMethod: 'stripe',
        paymentReconciling: false,
      })
    ).toBe(true);
  });

  it('allows first Stripe pay when awaiting', () => {
    expect(
      canStartStripePayment({
        shippingQuoteRequired: false,
        paymentStatus: 'pending',
        orderStatus: 'awaiting_payment',
        selectedPaymentMethod: 'stripe',
        paymentReconciling: false,
      })
    ).toBe(true);
  });

  it('blocks shipping-quote orders', () => {
    expect(
      canStartStripePayment({
        shippingQuoteRequired: true,
        paymentStatus: 'pending',
        orderStatus: 'awaiting_payment',
        selectedPaymentMethod: 'stripe',
        paymentReconciling: false,
      })
    ).toBe(false);
  });
});
