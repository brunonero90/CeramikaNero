import 'server-only';
import type Stripe from 'stripe';

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

type ExpiryCandidate = {
  order_id: string;
  order_reference: string;
  payment_id: string;
  provider: string;
  provider_checkout_id: string | null;
  expires_at: string;
};

export type ExpiredOrderResult = {
  examined: number;
  expired: number;
  deferred: number;
  failed: number;
};

type StripeClient = Pick<Stripe, 'checkout'>;

function isPaidOrProcessing(session: Stripe.Checkout.Session): boolean {
  if (session.payment_status === 'paid') return true;
  if (
    typeof session.payment_intent === 'object' &&
    session.payment_intent &&
    (session.payment_intent.status === 'succeeded' ||
      session.payment_intent.status === 'processing')
  ) {
    return true;
  }
  return false;
}

function isAuthoritativelyUnpayable(session: Stripe.Checkout.Session): boolean {
  return (
    session.status === 'expired' ||
    (session.status === 'complete' && session.payment_status !== 'paid')
  );
}

/**
 * Releases only order attempts that are certainly unable to become paid.
 *
 * Stripe rows with a Checkout id are checked at Stripe first. This prevents a
 * delayed webhook from racing the cron and releasing an order whose
 * PaymentIntent has already succeeded or is processing.
 */
export async function expireDueOrderHolds(
  supabase: RpcClient,
  getStripe: () => StripeClient
): Promise<ExpiredOrderResult> {
  const result: ExpiredOrderResult = {
    examined: 0,
    expired: 0,
    deferred: 0,
    failed: 0,
  };

  const { data, error } = await supabase.rpc('list_expired_unpaid_orders', {
    p_limit: 100,
  });
  if (error) {
    throw new Error('Failed to list expired unpaid orders');
  }

  const candidates = Array.isArray(data) ? (data as ExpiryCandidate[]) : [];
  result.examined = candidates.length;

  for (const candidate of candidates) {
    let safeToExpire = candidate.provider !== 'stripe';

    if (candidate.provider === 'stripe') {
      if (!candidate.provider_checkout_id) {
        // Checkout creation never completed, so no Stripe payment is possible.
        safeToExpire = true;
      } else {
        try {
          const session = await getStripe().checkout.sessions.retrieve(
            candidate.provider_checkout_id,
            { expand: ['payment_intent'] }
          );
          if (isPaidOrProcessing(session)) {
            result.deferred += 1;
            continue;
          }
          safeToExpire = isAuthoritativelyUnpayable(session);
          if (!safeToExpire) {
            result.deferred += 1;
            continue;
          }
        } catch (err) {
          console.error('Stripe expiry verification failed', {
            orderReference: candidate.order_reference,
            error: err instanceof Error ? err.message : 'unknown',
          });
          result.failed += 1;
          continue;
        }
      }
    }

    if (!safeToExpire) {
      result.deferred += 1;
      continue;
    }

    const expired = await supabase.rpc('expire_unpaid_order', {
      p_order_id: candidate.order_id,
      p_expected_payment_id: candidate.payment_id,
      p_expected_checkout_id: candidate.provider_checkout_id,
      p_reason: 'Payment deadline expired',
    });
    if (expired.error) {
      result.failed += 1;
      continue;
    }

    const status = (expired.data as { status?: string } | null)?.status;
    if (status === 'expired') result.expired += 1;
    else result.deferred += 1;
  }

  return result;
}
