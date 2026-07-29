import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const notifyPaymentReceived = vi.fn();
const notifyAdminProblem = vi.fn();
const notifyPaymentFailed = vi.fn();

vi.mock('@/lib/booking/email', () => ({
  sendBookingConfirmationEmail: vi.fn(),
  sendPaymentProblemEmail: vi.fn(),
  getBookingEmailContext: vi.fn(),
}));

vi.mock('@/lib/cart/order-email', () => ({
  notifyOrderPaymentReceived: (...args: unknown[]) =>
    notifyPaymentReceived(...args),
  notifyAdminOrderPaymentProblem: (...args: unknown[]) =>
    notifyAdminProblem(...args),
  notifyOrderStripeProcessing: vi.fn(),
  notifyOrderPaymentFailed: (...args: unknown[]) =>
    notifyPaymentFailed(...args),
}));

vi.mock('@/lib/supabase/cart-admin', () => ({
  createCartAdminClient: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const api = {
        select: () => api,
        eq: (col: string, val: unknown) => {
          filters[col] = val;
          return api;
        },
        maybeSingle: async () => {
          if (table === 'payments') {
            if (filters.provider_checkout_id === 'cs_order_1') {
              return {
                data: {
                  id: 'pay_order_1',
                  order_id: 'ord_1',
                  booking_id: null,
                  amount_gross_grosz: 18900,
                  status: 'pending',
                },
              };
            }
            if (filters.provider_payment_id === 'pi_order_1') {
              return {
                data: {
                  id: 'pay_order_1',
                  order_id: 'ord_1',
                  booking_id: null,
                  amount_gross_grosz: 18900,
                  status: 'pending',
                },
              };
            }
            if (filters.id === 'pay_order_1') {
              return {
                data: {
                  id: 'pay_order_1',
                  order_id: 'ord_1',
                  booking_id: null,
                  amount_gross_grosz: 18900,
                  status: 'pending',
                },
              };
            }
          }
          return { data: null };
        },
      };
      return api;
    },
  }),
}));

type Row = Record<string, unknown>;

function createSupabaseMock(state: {
  processedEventIds?: Set<string>;
  confirmResult?: Row | null;
  confirmError?: { message: string } | null;
  failConfirmOnce?: boolean;
}) {
  const processed = state.processedEventIds ?? new Set<string>();
  const claimed = new Set<string>();
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const updates: Array<{
    table: string;
    patch: Row;
    filters: Row;
  }> = [];
  let confirmAttempts = 0;

  const client = {
    from: (table: string) => {
      const filters: Row = {};
      let mode: 'select' | 'update' | 'upsert' = 'select';
      let upsertRows: Row[] = [];
      let updatePatch: Row = {};
      const api = {
        select: () => {
          mode = 'select';
          return api;
        },
        update: (patch: Row) => {
          mode = 'update';
          updatePatch = patch;
          return api;
        },
        upsert: (rows: Row | Row[]) => {
          mode = 'upsert';
          upsertRows = Array.isArray(rows) ? rows : [rows];
          return api;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return api;
        },
        maybeSingle: async () => {
          if (table === 'stripe_events' && filters.event_id) {
            return {
              data: processed.has(String(filters.event_id))
                ? { id: 'evt_row' }
                : null,
            };
          }
          return { data: null };
        },
        then: (resolve: (v: { data: null; error: null }) => unknown) => {
          if (mode === 'upsert') {
            for (const row of upsertRows) {
              processed.add(String(row.event_id));
            }
          }
          if (mode === 'update') {
            updates.push({
              table,
              patch: updatePatch,
              filters: { ...filters },
            });
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return api;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_stripe_event') {
        const id = String(args.p_event_id);
        if (processed.has(id)) {
          return { data: { status: 'already_processed' }, error: null };
        }
        claimed.add(id);
        return { data: { status: 'claimed' }, error: null };
      }
      if (name === 'complete_stripe_event') {
        processed.add(String(args.p_event_id));
        return { data: null, error: null };
      }
      if (name === 'fail_stripe_event') {
        return { data: null, error: null };
      }
      if (name === 'confirm_order_from_stripe') {
        confirmAttempts += 1;
        if (state.failConfirmOnce && confirmAttempts === 1) {
          return { data: null, error: { message: 'transient' } };
        }
        if (state.confirmError) {
          return { data: null, error: state.confirmError };
        }
        return {
          data: state.confirmResult ?? { status: 'confirmed' },
          error: null,
        };
      }
      if (name === 'fail_stripe_payment_attempt') {
        return {
          data: {
            status: 'failed',
            updated: true,
            order_id: 'ord_1',
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    __rpcCalls: rpcCalls,
    __processed: processed,
    __updates: updates,
  };

  return client;
}

function orderSessionEvent(
  type: Stripe.Event.Type,
  overrides: Partial<Stripe.Checkout.Session> = {},
  id = 'evt_order_1'
): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: 'cs_order_1',
        object: 'checkout.session',
        amount_total: 18900,
        currency: 'pln',
        livemode: false,
        payment_status: 'paid',
        payment_intent: 'pi_order_1',
        status: 'complete',
        metadata: {
          entity_type: 'order',
          order_id: 'ord_1',
          payment_id: 'pay_order_1',
          order_reference: 'CN-O-20260728-E85001',
        },
        ...overrides,
      },
    },
  } as Stripe.Event;
}

describe('unified CN-O Stripe webhook (BLIK)', () => {
  beforeEach(() => {
    vi.resetModules();
    notifyPaymentReceived.mockReset();
    notifyAdminProblem.mockReset();
    notifyPaymentFailed.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('confirms order once on checkout.session.completed paid and queues payment email', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const result = await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed')
    );
    expect(result).toEqual({ ok: true });
    expect(
      supabase.__rpcCalls.filter((c) => c.name === 'confirm_order_from_stripe')
    ).toHaveLength(1);
    expect(notifyPaymentReceived).toHaveBeenCalledWith('ord_1');
  });

  it('duplicate webhook is harmless and does not re-confirm', async () => {
    const processed = new Set<string>(['evt_order_1']);
    const supabase = createSupabaseMock({ processedEventIds: processed });
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const result = await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed')
    );
    expect(result).toEqual({ ok: true, duplicate: true });
    expect(
      supabase.__rpcCalls.filter((c) => c.name === 'confirm_order_from_stripe')
    ).toHaveLength(0);
    expect(notifyPaymentReceived).not.toHaveBeenCalled();
  });

  it('async_payment_succeeded confirms the same way', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const result = await processStripeEvent(
      supabase as never,
      orderSessionEvent(
        'checkout.session.async_payment_succeeded',
        {},
        'evt_async'
      )
    );
    expect(result.ok).toBe(true);
    expect(notifyPaymentReceived).toHaveBeenCalledWith('ord_1');
  });

  it('async BLIK decline leaves the order unpaid and queues one failure email', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const event = orderSessionEvent(
      'checkout.session.async_payment_failed',
      { payment_status: 'unpaid' },
      'evt_blik_declined'
    );

    const first = await processStripeEvent(supabase as never, event);
    const second = await processStripeEvent(supabase as never, event);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true, duplicate: true });
    expect(
      supabase.__rpcCalls.filter((c) => c.name === 'confirm_order_from_stripe')
    ).toHaveLength(0);
    expect(
      supabase.__rpcCalls.find((c) => c.name === 'fail_stripe_payment_attempt')
        ?.args
    ).toEqual(
      expect.objectContaining({
        p_payment_id: 'pay_order_1',
        p_provider_checkout_id: 'cs_order_1',
        p_failure_code: 'async_payment_failed',
      })
    );
    expect(notifyPaymentFailed).toHaveBeenCalledTimes(1);
    expect(notifyPaymentFailed).toHaveBeenCalledWith('ord_1', 'payment_failed');
    expect(notifyPaymentReceived).not.toHaveBeenCalled();
  });

  it('card decline records failure without confirming the CN-O order', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const event = {
      id: 'evt_card_declined',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_order_1',
          object: 'payment_intent',
          amount: 18900,
          amount_received: 0,
          currency: 'pln',
          livemode: false,
          status: 'requires_payment_method',
          metadata: {
            entity_type: 'order',
            order_id: 'ord_1',
            payment_id: 'pay_order_1',
          },
          last_payment_error: {
            code: 'card_declined',
            decline_code: 'generic_decline',
            message: 'Your card was declined.',
          },
        },
      },
    } as unknown as Stripe.Event;

    const first = await processStripeEvent(supabase as never, event);
    const second = await processStripeEvent(supabase as never, event);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true, duplicate: true });
    expect(
      supabase.__rpcCalls.filter((c) => c.name === 'confirm_order_from_stripe')
    ).toHaveLength(0);
    expect(
      supabase.__rpcCalls.find((c) => c.name === 'fail_stripe_payment_attempt')
        ?.args
    ).toEqual(
      expect.objectContaining({
        p_payment_id: 'pay_order_1',
        p_provider_payment_id: 'pi_order_1',
        p_failure_code: 'card_declined',
      })
    );
    expect(notifyPaymentFailed).toHaveBeenCalledTimes(1);
    expect(notifyPaymentFailed).toHaveBeenCalledWith('ord_1', 'payment_failed');
    expect(notifyPaymentReceived).not.toHaveBeenCalled();
  });

  it('failed processing returns 5xx and can succeed on retry', async () => {
    const supabase = createSupabaseMock({ failConfirmOnce: true });
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const first = await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed', {}, 'evt_retry')
    );
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.status).toBe(500);

    // Simulate Stripe retry of the same event after fail (not marked processed).
    supabase.__processed.delete('evt_retry');
    const second = await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed', {}, 'evt_retry')
    );
    expect(second).toEqual({ ok: true });
    expect(notifyPaymentReceived).toHaveBeenCalledTimes(1);
  });

  it('payment_intent.succeeded plus completed does not double-email', async () => {
    const supabase = createSupabaseMock({
      confirmResult: { status: 'confirmed' },
    });
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');

    await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed', {}, 'evt_a')
    );

    const piEvent = {
      id: 'evt_pi',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_order_1',
          object: 'payment_intent',
          amount: 18900,
          amount_received: 18900,
          currency: 'pln',
          livemode: false,
          status: 'succeeded',
          metadata: {
            entity_type: 'order',
            order_id: 'ord_1',
            payment_id: 'pay_order_1',
          },
          last_payment_error: null,
        },
      },
    } as unknown as Stripe.Event;

    // Second confirm returns already_processed from RPC perspective
    const supabase2 = createSupabaseMock({
      confirmResult: { already_processed: true },
    });
    await processStripeEvent(supabase2 as never, piEvent);
    // First path emailed once; already_processed path must not email again.
    expect(notifyPaymentReceived).toHaveBeenCalledTimes(1);
  });

  it('unpaid completed records processing without confirming', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('@/lib/booking/stripe-webhook');
    const result = await processStripeEvent(
      supabase as never,
      orderSessionEvent('checkout.session.completed', {
        payment_status: 'unpaid',
      })
    );
    expect(result.ok).toBe(true);
    expect(
      supabase.__rpcCalls.filter((c) => c.name === 'confirm_order_from_stripe')
    ).toHaveLength(0);
    expect(notifyPaymentReceived).not.toHaveBeenCalled();
  });
});
