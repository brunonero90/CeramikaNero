import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { expireDueOrderHolds } from '../order-expiry';

function rpcClient(
  candidates: Array<Record<string, unknown>>,
  expireStatus = 'expired'
) {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        if (name === 'list_expired_unpaid_orders') {
          return { data: candidates, error: null };
        }
        return { data: { status: expireStatus }, error: null };
      },
    },
  };
}

const base = {
  order_id: 'ord_1',
  order_reference: 'CN-O-1',
  payment_id: 'pay_1',
  provider: 'stripe',
  provider_checkout_id: 'cs_1',
  expires_at: '2026-07-29T10:00:00.000Z',
};

describe('expireDueOrderHolds', () => {
  it('expires an authoritatively expired Stripe Checkout once', async () => {
    const { client, calls } = rpcClient([base]);
    const retrieve = vi.fn().mockResolvedValue({
      status: 'expired',
      payment_status: 'unpaid',
      payment_intent: null,
    });

    const result = await expireDueOrderHolds(
      client,
      () =>
        ({
          checkout: { sessions: { retrieve } },
        }) as never
    );

    expect(result).toEqual({
      examined: 1,
      expired: 1,
      deferred: 0,
      failed: 0,
    });
    expect(
      calls.find((call) => call.name === 'expire_unpaid_order')?.args
    ).toEqual(
      expect.objectContaining({
        p_order_id: 'ord_1',
        p_expected_payment_id: 'pay_1',
        p_expected_checkout_id: 'cs_1',
      })
    );
  });

  it('does not release a succeeded or processing Stripe payment', async () => {
    const { client, calls } = rpcClient([base]);
    const retrieve = vi.fn().mockResolvedValue({
      status: 'complete',
      payment_status: 'unpaid',
      payment_intent: { status: 'processing' },
    });

    const result = await expireDueOrderHolds(
      client,
      () =>
        ({
          checkout: { sessions: { retrieve } },
        }) as never
    );

    expect(result.deferred).toBe(1);
    expect(calls.some((call) => call.name === 'expire_unpaid_order')).toBe(
      false
    );
  });

  it('expires a bank-transfer deadline without calling Stripe', async () => {
    const { client, calls } = rpcClient([
      {
        ...base,
        provider: 'bank_transfer',
        provider_checkout_id: null,
      },
    ]);
    const getStripe = vi.fn();

    const result = await expireDueOrderHolds(client, getStripe);

    expect(result.expired).toBe(1);
    expect(getStripe).not.toHaveBeenCalled();
    expect(calls.some((call) => call.name === 'expire_unpaid_order')).toBe(
      true
    );
  });

  it('fails closed when Stripe cannot verify the Session', async () => {
    const { client, calls } = rpcClient([base]);
    const retrieve = vi.fn().mockRejectedValue(new Error('Stripe unavailable'));

    const result = await expireDueOrderHolds(
      client,
      () =>
        ({
          checkout: { sessions: { retrieve } },
        }) as never
    );

    expect(result.failed).toBe(1);
    expect(calls.some((call) => call.name === 'expire_unpaid_order')).toBe(
      false
    );
  });
});
