import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const retrieveSession = vi.fn();
const notifyPaymentReceived = vi.fn();
const rpc = vi.fn();
const emailUpdates: Array<Record<string, unknown>> = [];

vi.mock('@/lib/stripe/server', () => ({
  getStripeServerClient: () => ({
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => retrieveSession(...args),
      },
    },
  }),
}));

vi.mock('@/lib/cart/order-email', () => ({
  notifyOrderPaymentReceived: (...args: unknown[]) =>
    notifyPaymentReceived(...args),
}));

vi.mock('@/lib/supabase/cart-admin', () => ({
  createCartAdminClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> = {};
      const api = {
        select: () => api,
        update: (next: Record<string, unknown>) => {
          patch = next;
          return api;
        },
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return api;
        },
        in: () => api,
        order: () => api,
        limit: () => api,
        maybeSingle: async () => {
          if (table === 'orders') {
            return {
              data: {
                id: 'ord_1',
                order_reference: 'CN-O-20260728-405306',
                payment_status: 'pending',
                status: 'awaiting_payment',
                total_gross_grosz: 14900,
              },
            };
          }
          if (table === 'payments') {
            if (filters.provider_checkout_id === 'cs_test_paid') {
              return {
                data: {
                  id: 'pay_1',
                  order_id: 'ord_1',
                  status: 'created',
                  amount_gross_grosz: 14900,
                  provider_payment_id: null,
                },
              };
            }
            return {
              data: {
                id: 'pay_1',
                order_id: 'ord_1',
                status: 'created',
                amount_gross_grosz: 14900,
              },
            };
          }
          return { data: null };
        },
        then: (resolve: (v: { data: null; error: null }) => unknown) => {
          if (table === 'order_emails' && patch.status === 'sent') {
            emailUpdates.push({ ...patch, filters: { ...filters } });
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return api;
    },
    rpc: (...args: unknown[]) => rpc(...args),
  }),
}));

describe('reconcileOrderCheckoutFromSession', () => {
  beforeEach(() => {
    retrieveSession.mockReset();
    notifyPaymentReceived.mockReset();
    rpc.mockReset();
    emailUpdates.length = 0;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('confirms paid Checkout Session via Stripe API and queues payment email', async () => {
    retrieveSession.mockResolvedValue({
      id: 'cs_test_paid',
      payment_status: 'paid',
      status: 'complete',
      amount_total: 14900,
      currency: 'pln',
      livemode: false,
      payment_intent: 'pi_test_1',
      metadata: {
        entity_type: 'order',
        order_id: 'ord_1',
        payment_id: 'pay_1',
        order_reference: 'CN-O-20260728-405306',
      },
    });
    rpc.mockResolvedValue({
      data: { status: 'confirmed' },
      error: null,
    });

    const { reconcileOrderCheckoutFromSession } =
      await import('../reconcile-order-checkout');

    const result = await reconcileOrderCheckoutFromSession({
      publicLookupToken: 'a'.repeat(64),
      checkoutSessionId: 'cs_test_paid',
    });

    expect(result).toEqual({ ok: true, status: 'confirmed' });
    expect(rpc).toHaveBeenCalledWith(
      'confirm_order_from_stripe',
      expect.objectContaining({
        p_order_id: 'ord_1',
        p_payment_id: 'pay_1',
        p_stripe_event_id: 'return_reconcile_cs_test_paid',
        p_provider_payment_id: 'pi_test_1',
        p_amount_gross_grosz: 14900,
        p_currency: 'pln',
        p_livemode: false,
      })
    );
    expect(notifyPaymentReceived).toHaveBeenCalledWith('ord_1');
  });

  it('does not confirm when Stripe session is still unpaid', async () => {
    retrieveSession.mockResolvedValue({
      id: 'cs_test_open',
      payment_status: 'unpaid',
      status: 'open',
      amount_total: 14900,
      payment_intent: null,
      metadata: {
        order_id: 'ord_1',
        payment_id: 'pay_1',
      },
    });

    const { reconcileOrderCheckoutFromSession } =
      await import('../reconcile-order-checkout');

    const result = await reconcileOrderCheckoutFromSession({
      publicLookupToken: 'a'.repeat(64),
      checkoutSessionId: 'cs_test_open',
    });

    expect(result).toEqual({ ok: true, status: 'unpaid' });
    expect(rpc).not.toHaveBeenCalled();
    expect(notifyPaymentReceived).not.toHaveBeenCalled();
  });

  it('rejects session that belongs to a different order', async () => {
    retrieveSession.mockResolvedValue({
      id: 'cs_other',
      payment_status: 'paid',
      status: 'complete',
      amount_total: 14900,
      payment_intent: 'pi_x',
      metadata: {
        order_id: 'ord_OTHER',
        payment_id: 'pay_x',
        order_reference: 'CN-O-OTHER',
      },
    });

    const { reconcileOrderCheckoutFromSession } =
      await import('../reconcile-order-checkout');

    const result = await reconcileOrderCheckoutFromSession({
      publicLookupToken: 'a'.repeat(64),
      checkoutSessionId: 'cs_other',
    });

    expect(result).toEqual({ ok: false, error: 'session_mismatch' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
