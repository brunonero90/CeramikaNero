import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const sendConfirmation = vi.fn();
const sendPaymentProblem = vi.fn();
const getEmailContext = vi.fn();

vi.mock('@/lib/booking/email', () => ({
  sendBookingConfirmationEmail: (...args: unknown[]) =>
    sendConfirmation(...args),
  sendPaymentProblemEmail: (...args: unknown[]) => sendPaymentProblem(...args),
  getBookingEmailContext: (...args: unknown[]) => getEmailContext(...args),
}));

type Row = Record<string, unknown>;

function createSupabaseMock(state: {
  existingEventIds?: Set<string>;
  bookings?: Map<string, Row>;
  paymentsById?: Map<string, Row>;
  paymentsByIntent?: Map<string, Row>;
  paymentsByCheckout?: Map<string, Row>;
  confirmResult?: Row | null;
  confirmError?: { message: string } | null;
}) {
  const insertedEvents: Array<{ event_id: string; event_type: string }> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; patch: Row; filters: Row }> = [];

  const existing = state.existingEventIds ?? new Set<string>();
  const bookings = state.bookings ?? new Map();
  const paymentsById = state.paymentsById ?? new Map();
  const paymentsByIntent = state.paymentsByIntent ?? new Map();
  const paymentsByCheckout = state.paymentsByCheckout ?? new Map();

  function from(table: string) {
    const filters: Row = {};
    let mode: 'select' | 'update' | 'upsert' = 'select';
    let patch: Row = {};
    let upsertRows: Row[] = [];

    const api = {
      select() {
        mode = 'select';
        return api;
      },
      update(next: Row) {
        mode = 'update';
        patch = next;
        return api;
      },
      upsert(rows: Row | Row[]) {
        mode = 'upsert';
        upsertRows = Array.isArray(rows) ? rows : [rows];
        return api;
      },
      eq(column: string, value: unknown) {
        filters[column] = value;
        return api;
      },
      maybeSingle: async () => {
        if (table === 'stripe_events' && filters.event_id) {
          return {
            data: existing.has(String(filters.event_id))
              ? { id: 'evt_row' }
              : null,
          };
        }
        if (table === 'payments') {
          if (filters.provider_payment_id) {
            return {
              data:
                paymentsByIntent.get(String(filters.provider_payment_id)) ??
                null,
            };
          }
          if (filters.id) {
            return { data: paymentsById.get(String(filters.id)) ?? null };
          }
        }
        return { data: null };
      },
      single: async () => {
        if (table === 'bookings' && filters.id) {
          return { data: bookings.get(String(filters.id)) ?? null };
        }
        if (table === 'payments') {
          if (filters.provider_payment_id) {
            return {
              data:
                paymentsByIntent.get(String(filters.provider_payment_id)) ??
                null,
            };
          }
          if (filters.id) {
            return { data: paymentsById.get(String(filters.id)) ?? null };
          }
        }
        return { data: null };
      },
      then(resolve: (value: { data: null; error: null }) => unknown) {
        if (mode === 'update') {
          updates.push({ table, patch, filters: { ...filters } });
          if (table === 'payments' && filters.provider_checkout_id) {
            paymentsByCheckout.set(String(filters.provider_checkout_id), {
              ...(paymentsByCheckout.get(
                String(filters.provider_checkout_id)
              ) ?? {}),
              ...patch,
            });
          }
        }
        if (mode === 'upsert') {
          for (const row of upsertRows) {
            insertedEvents.push({
              event_id: String(row.event_id),
              event_type: String(row.event_type),
            });
            existing.add(String(row.event_id));
          }
        }
        return Promise.resolve(resolve({ data: null, error: null }));
      },
    };

    return api;
  }

  const client = {
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === 'claim_stripe_event') {
        if (existing.has(String(args.p_event_id))) {
          return { data: { status: 'already_processed' }, error: null };
        }
        existing.add(String(args.p_event_id));
        return { data: { status: 'claimed' }, error: null };
      }
      if (name === 'complete_stripe_event' || name === 'fail_stripe_event') {
        return { data: null, error: null };
      }
      if (name === 'confirm_booking_from_payment') {
        if (state.confirmError) {
          return { data: null, error: state.confirmError };
        }
        return {
          data: state.confirmResult ?? { status: 'confirmed' },
          error: null,
        };
      }
      if (name === 'confirm_order_from_payment') {
        if (state.confirmError) {
          return { data: null, error: state.confirmError };
        }
        return {
          data: state.confirmResult ?? { status: 'confirmed' },
          error: null,
        };
      }
      return { data: { status: 'cancelled' }, error: null };
    },
    __insertedEvents: insertedEvents,
    __rpcCalls: rpcCalls,
    __updates: updates,
  };

  return client;
}

function sessionEvent(
  type: Stripe.Event.Type,
  session: Partial<Stripe.Checkout.Session>,
  id = 'evt_session_1'
): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: 'cs_test_1',
        object: 'checkout.session',
        amount_total: 10000,
        payment_status: 'paid',
        payment_intent: 'pi_test_1',
        metadata: {
          booking_id: 'book_1',
          payment_id: 'pay_1',
          booking_reference: 'CN-1',
        },
        ...session,
      },
    },
  } as Stripe.Event;
}

function intentEvent(
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed',
  intent: Partial<Stripe.PaymentIntent>,
  id = 'evt_pi_1'
): Stripe.Event {
  return {
    id,
    type,
    data: {
      object: {
        id: 'pi_test_1',
        object: 'payment_intent',
        amount: 10000,
        metadata: {
          booking_id: 'book_1',
          payment_id: 'pay_1',
          booking_reference: 'CN-1',
        },
        ...intent,
      },
    },
  } as Stripe.Event;
}

function rpcNamed(
  supabase: {
    __rpcCalls: Array<{ name: string; args: Record<string, unknown> }>;
  },
  name: string
) {
  return supabase.__rpcCalls.find((c) => c.name === name);
}

describe('processStripeEvent', () => {
  beforeEach(() => {
    sendConfirmation.mockReset();
    sendPaymentProblem.mockReset();
    getEmailContext.mockReset();
    getEmailContext.mockResolvedValue({
      bookingId: 'book_1',
      reference: 'CN-1',
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('confirms immediately paid checkout.session.completed and records the event', async () => {
    const supabase = createSupabaseMock({
      confirmResult: { status: 'confirmed' },
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', { payment_status: 'paid' })
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'claim_stripe_event')?.args.p_event_id).toBe(
      'evt_session_1'
    );
    expect(
      rpcNamed(supabase, 'confirm_booking_from_payment')?.args
        .p_amount_gross_grosz
    ).toBe(10000);
    expect(rpcNamed(supabase, 'complete_stripe_event')).toBeTruthy();
    expect(sendConfirmation).toHaveBeenCalled();
  });

  it('ignores duplicate Stripe event ids', async () => {
    const supabase = createSupabaseMock({
      existingEventIds: new Set(['evt_dup']),
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', {}, 'evt_dup')
    );

    expect(result).toEqual({ ok: true, duplicate: true });
    expect(rpcNamed(supabase, 'claim_stripe_event')).toBeTruthy();
    expect(rpcNamed(supabase, 'confirm_booking_from_payment')).toBeUndefined();
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it('does not confirm unpaid checkout.session.completed (delayed payment)', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', {
        payment_status: 'unpaid',
        payment_intent: 'pi_pending',
      })
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'confirm_booking_from_payment')).toBeUndefined();
    expect(rpcNamed(supabase, 'complete_stripe_event')).toBeTruthy();
    expect(supabase.__updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'payments',
          patch: expect.objectContaining({
            provider_checkout_id: 'cs_test_1',
            provider_payment_id: 'pi_pending',
          }),
        }),
      ])
    );
  });

  it('confirms delayed success via checkout.session.async_payment_succeeded', async () => {
    const supabase = createSupabaseMock({
      confirmResult: { status: 'confirmed' },
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.async_payment_succeeded', {
        payment_status: 'paid',
      })
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'confirm_booking_from_payment')).toBeTruthy();
    expect(sendConfirmation).toHaveBeenCalled();
  });

  it('marks failed async payment and cancels a pending hold', async () => {
    const supabase = createSupabaseMock({
      bookings: new Map([['book_1', { id: 'book_1', status: 'pending' }]]),
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.async_payment_failed', {
        payment_status: 'unpaid',
      })
    );

    expect(result).toEqual({ ok: true });
    expect(supabase.__updates[0]?.patch).toEqual(
      expect.objectContaining({ status: 'failed' })
    );
    expect(rpcNamed(supabase, 'cancel_booking')).toEqual(
      expect.objectContaining({
        name: 'cancel_booking',
        args: expect.objectContaining({ p_booking_id: 'book_1' }),
      })
    );
  });

  it('expires checkout by cancelling pending booking and failing payment', async () => {
    const supabase = createSupabaseMock({
      bookings: new Map([['book_1', { id: 'book_1', status: 'pending' }]]),
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.expired', { payment_status: 'unpaid' })
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'cancel_booking')?.name).toBe('cancel_booking');
    expect(supabase.__updates.some((u) => u.patch.status === 'failed')).toBe(
      true
    );
  });

  it('handles payment_intent.succeeded via metadata when intent id is not stored yet', async () => {
    const supabase = createSupabaseMock({
      paymentsById: new Map([
        [
          'pay_1',
          {
            id: 'pay_1',
            booking_id: 'book_1',
            amount_gross_grosz: 10000,
            status: 'created',
          },
        ],
      ]),
      confirmResult: { status: 'confirmed' },
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      intentEvent('payment_intent.succeeded', {})
    );

    expect(result).toEqual({ ok: true });
    expect(
      rpcNamed(supabase, 'confirm_booking_from_payment')?.args.p_payment_id
    ).toBe('pay_1');
    expect(sendConfirmation).toHaveBeenCalled();
  });

  it('marks declined payment_intent.payment_failed without confirming', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      intentEvent('payment_intent.payment_failed', {
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
        } as Stripe.PaymentIntent.LastPaymentError,
      })
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'confirm_booking_from_payment')).toBeUndefined();
    expect(rpcNamed(supabase, 'complete_stripe_event')).toBeTruthy();
    expect(supabase.__updates[0]?.patch).toEqual(
      expect.objectContaining({
        status: 'failed',
        failure_code: 'card_declined',
      })
    );
  });

  it('surfaces manual resolution for late payment without restoring capacity in app code', async () => {
    const supabase = createSupabaseMock({
      confirmResult: { status: 'requires_manual_resolution', recovered: false },
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', { payment_status: 'paid' })
    );

    expect(result).toEqual({ ok: true });
    expect(sendConfirmation).not.toHaveBeenCalled();
    expect(sendPaymentProblem).toHaveBeenCalled();
  });

  it('rejects amount mismatch from confirm RPC as a processing failure', async () => {
    const supabase = createSupabaseMock({
      confirmError: { message: 'Payment amount mismatch' },
    });
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', {
        payment_status: 'paid',
        amount_total: 1,
      })
    );

    expect(result).toEqual({
      ok: false,
      status: 500,
      error: 'Confirmation failed',
    });
  });

  it('rejects checkout sessions missing booking metadata', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      sessionEvent('checkout.session.completed', {
        payment_status: 'paid',
        metadata: {},
      })
    );

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Missing metadata',
    });
  });

  it('acknowledges charge.refunded without recording a refund in app state', async () => {
    const supabase = createSupabaseMock({});
    const { processStripeEvent } = await import('../stripe-webhook');

    const result = await processStripeEvent(
      supabase as never,
      {
        id: 'evt_refund',
        type: 'charge.refunded',
        data: { object: { id: 'ch_1', payment_intent: 'pi_1' } },
      } as Stripe.Event
    );

    expect(result).toEqual({ ok: true });
    expect(rpcNamed(supabase, 'confirm_booking_from_payment')).toBeUndefined();
    expect(rpcNamed(supabase, 'claim_stripe_event')?.args.p_event_id).toBe(
      'evt_refund'
    );
    expect(rpcNamed(supabase, 'complete_stripe_event')).toBeTruthy();
  });
});

describe('webhook signature verification', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/stripe/server');
    vi.doUnmock('@/lib/supabase/admin');
    vi.doUnmock('@/lib/booking/rate-limit');
    vi.doUnmock('@/lib/booking/stripe-webhook');
  });

  it('rejects invalid signatures without processing', async () => {
    vi.doMock('@/lib/stripe/server', () => ({
      getStripeServerClient: () => ({
        webhooks: {
          constructEvent: () => {
            throw new Error('Invalid signature');
          },
        },
      }),
      getStripeWebhookSecret: () => 'whsec_test',
    }));
    vi.doMock('@/lib/supabase/admin', () => ({
      createAdminClient: () => {
        throw new Error('should not create admin client');
      },
    }));
    vi.doMock('@/lib/booking/rate-limit', () => ({
      getRateLimitKeys: async () => ({ ipKey: 'ip' }),
      checkWebhookRateLimit: async () => ({ success: true }),
    }));
    const processMock = vi.fn();
    vi.doMock('@/lib/booking/stripe-webhook', () => ({
      processStripeEvent: processMock,
    }));

    const { POST } = await import('../../../app/api/webhooks/stripe/route');
    const response = await POST(
      new Request('https://ceramikanero.pl/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'bad' },
        body: '{"id":"evt"}',
      })
    );

    expect(response.status).toBe(400);
    expect(processMock).not.toHaveBeenCalled();
    const json = (await response.json()) as { error: string };
    expect(json.error).toMatch(/Invalid signature/);
  });
});
