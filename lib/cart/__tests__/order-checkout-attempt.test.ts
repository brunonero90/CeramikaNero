import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createStripeSession = vi.fn();
const retrieveCheckout = vi.fn();
const retrieveIntent = vi.fn();
const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
const updates: Array<{
  table: string;
  patch: Record<string, unknown>;
  filters: Record<string, unknown>;
}> = [];

let preparedResult: Record<string, unknown> = {};

vi.mock('@/lib/booking/local-mode', () => ({
  isStripeConfigured: () => true,
}));

vi.mock('@/lib/payments/stripe-checkout', () => ({
  createEntityStripeCheckoutSession: (...args: unknown[]) =>
    createStripeSession(...args),
}));

vi.mock('@/lib/stripe/server', () => ({
  getStripeServerClient: () => ({
    checkout: { sessions: { retrieve: retrieveCheckout } },
    paymentIntents: { retrieve: retrieveIntent },
  }),
}));

vi.mock('@/lib/supabase/cart-admin', () => ({
  createCartAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_order_checkout_attempt') {
        return { data: { status: 'eligible' }, error: null };
      }
      if (name === 'prepare_order_checkout_attempt') {
        return { data: preparedResult, error: null };
      }
      return { data: null, error: null };
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> = {};
      let mode: 'select' | 'update' = 'select';
      const api = {
        select: () => {
          mode = 'select';
          return api;
        },
        update: (next: Record<string, unknown>) => {
          mode = 'update';
          patch = next;
          return api;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return api;
        },
        in: () => api,
        order: () => api,
        maybeSingle: async () => {
          if (table === 'orders') {
            return {
              data: {
                id: 'ord_1',
                order_reference: 'CN-O-TEST',
                status: 'awaiting_payment',
                payment_status: 'pending',
                total_gross_grosz: 14900,
                shipping_quote_required: false,
                selected_payment_method: 'stripe',
                customer_profiles: { email: 'owner@example.invalid' },
                order_items: [{ title_snapshot: 'Warsztat', quantity: 1 }],
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then: (resolve: (value: { data: unknown; error: null }) => unknown) => {
          if (mode === 'update') {
            updates.push({ table, patch, filters: { ...filters } });
          }
          return Promise.resolve(
            resolve({
              data: table === 'payments' && mode === 'select' ? [] : null,
              error: null,
            })
          );
        },
      };
      return api;
    },
  }),
}));

describe('createOrReuseOrderCheckoutSession attempt claim', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl');
    rpcCalls.length = 0;
    updates.length = 0;
    createStripeSession.mockReset();
    retrieveCheckout.mockReset();
    retrieveIntent.mockReset();
    preparedResult = {
      status: 'claimed',
      payment_id: 'pay_1',
      stripe_idempotency_key: 'checkout-order-ord_1-attempt_1',
    };
    createStripeSession.mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.test/cs_test_1',
      status: 'open',
      payment_status: 'unpaid',
      livemode: false,
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the atomically persisted key for the Stripe request', async () => {
    const { createOrReuseOrderCheckoutSession } =
      await import('../order-checkout');

    const result = await createOrReuseOrderCheckoutSession({
      orderId: 'ord_1',
      publicLookupToken: 'a'.repeat(64),
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        paymentId: 'pay_1',
        sessionId: 'cs_test_1',
        reused: false,
      })
    );
    expect(
      rpcCalls.find((call) => call.name === 'prepare_order_checkout_attempt')
    ).toBeTruthy();
    expect(createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay_1',
        totalGrosz: 14900,
        idempotencyKey: 'checkout-order-ord_1-attempt_1',
      })
    );
  });

  it('does not create a competing session while another caller is creating', async () => {
    preparedResult = { status: 'creating', payment_id: 'pay_1' };
    const { createOrReuseOrderCheckoutSession } =
      await import('../order-checkout');

    const result = await createOrReuseOrderCheckoutSession({
      orderId: 'ord_1',
      publicLookupToken: 'a'.repeat(64),
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'reconciling' })
    );
    expect(createStripeSession).not.toHaveBeenCalled();
  });

  it('preserves the durable attempt key when the Stripe request may have succeeded remotely', async () => {
    createStripeSession.mockRejectedValue(new Error('connection reset'));
    const { createOrReuseOrderCheckoutSession } =
      await import('../order-checkout');

    const result = await createOrReuseOrderCheckoutSession({
      orderId: 'ord_1',
      publicLookupToken: 'a'.repeat(64),
    });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'not_eligible' })
    );
    expect(createStripeSession).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'checkout-order-ord_1-attempt_1',
      })
    );
    expect(
      updates.some(
        ({ table, patch }) =>
          table === 'payments' &&
          (patch.status === 'failed' || patch.idempotency_key !== undefined)
      )
    ).toBe(false);
  });
});
