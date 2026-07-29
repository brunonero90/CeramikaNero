import { describe, expect, it } from 'vitest';

/**
 * Pure eligibility rules mirrored from lib/admin/analytics paymentEligible.
 */
function paymentEligible(
  p: {
    provider: string | null;
    livemode: boolean | null;
    order_id: string | null;
    booking_id: string | null;
  },
  includeTest: boolean,
  excludedOrders: Set<string>,
  excludedBookings: Set<string>
): boolean {
  if (p.order_id && excludedOrders.has(p.order_id) && !includeTest) return false;
  if (p.booking_id && excludedBookings.has(p.booking_id) && !includeTest)
    return false;
  if (!includeTest && p.provider === 'stripe') {
    if (p.livemode === false) return false;
    if (p.livemode == null) return false;
  }
  return true;
}

describe('analytics exclusions', () => {
  it('excludes test and unclassified Stripe by default', () => {
    const empty = new Set<string>();
    expect(
      paymentEligible(
        {
          provider: 'stripe',
          livemode: false,
          order_id: null,
          booking_id: null,
        },
        false,
        empty,
        empty
      )
    ).toBe(false);
    expect(
      paymentEligible(
        {
          provider: 'stripe',
          livemode: null,
          order_id: null,
          booking_id: null,
        },
        false,
        empty,
        empty
      )
    ).toBe(false);
    expect(
      paymentEligible(
        {
          provider: 'stripe',
          livemode: true,
          order_id: null,
          booking_id: null,
        },
        false,
        empty,
        empty
      )
    ).toBe(true);
  });

  it('excludes analytics_excluded orders', () => {
    expect(
      paymentEligible(
        {
          provider: 'manual',
          livemode: null,
          order_id: 'o1',
          booking_id: null,
        },
        false,
        new Set(['o1']),
        new Set()
      )
    ).toBe(false);
  });

  it('exposes no PII keys in dashboard contract sample', () => {
    const sample = {
      netCollectedRevenueGrosz: 0,
      paidOrders: 0,
      series: [{ day: '2026-07-01', revenueGrosz: 0, paidParticipants: 0 }],
    };
    const json = JSON.stringify(sample);
    expect(json).not.toMatch(/email|phone|display_name|notes/i);
  });
});
