import 'server-only';
import { createHash } from 'node:crypto';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { getStripeServerClient } from '@/lib/stripe/server';

export type ReconcileCheckoutResult =
  | { ok: true; status: 'confirmed' | 'already_paid' | 'pending' | 'unpaid' }
  | { ok: false; error: string };

function hashLookupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Authoritative return-path reconciliation: load Checkout Session from Stripe
 * (secret key) and confirm the unified order when Stripe reports paid.
 *
 * Complements webhooks when delivery is delayed or misconfigured. Does not
 * trust browser flags alone — only Stripe API payment_status / PI status.
 */
export async function reconcileOrderCheckoutFromSession(params: {
  publicLookupToken: string;
  checkoutSessionId: string;
}): Promise<ReconcileCheckoutResult> {
  const token = params.publicLookupToken.trim();
  const sessionId = params.checkoutSessionId.trim();
  if (!/^[a-f0-9]{32,128}$/i.test(token)) {
    return { ok: false, error: 'invalid_token' };
  }
  if (!/^cs_[a-zA-Z0-9]+/.test(sessionId)) {
    return { ok: false, error: 'invalid_session' };
  }

  const supabase = createCartAdminClient();
  const hash = hashLookupToken(token);

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_reference, payment_status, status, total_gross_grosz')
    .eq('public_lookup_token_hash', hash)
    .maybeSingle();

  if (orderError || !order) {
    return { ok: false, error: 'order_not_found' };
  }

  if (order.payment_status === 'paid') {
    await suppressAwaitingStripeEmails(order.id);
    return { ok: true, status: 'already_paid' };
  }

  if (
    order.status === 'cancelled' ||
    order.status === 'expired' ||
    order.status === 'refunded'
  ) {
    return { ok: false, error: 'order_terminal' };
  }

  let session;
  try {
    const stripe = getStripeServerClient();
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  } catch (err) {
    console.error('reconcile: stripe session retrieve failed', err);
    return { ok: false, error: 'stripe_retrieve_failed' };
  }

  const metaOrderId = session.metadata?.order_id ?? null;
  const metaPaymentId = session.metadata?.payment_id ?? null;
  const metaRef = session.metadata?.order_reference ?? null;

  if (metaOrderId && metaOrderId !== order.id) {
    console.error('reconcile: session order_id mismatch');
    return { ok: false, error: 'session_mismatch' };
  }
  if (metaRef && metaRef !== order.order_reference) {
    console.error('reconcile: session order_reference mismatch');
    return { ok: false, error: 'session_mismatch' };
  }

  // Bind session to this order via payments row when metadata is incomplete.
  const { data: paymentByCheckout } = await supabase
    .from('payments')
    .select('id, order_id, status, amount_gross_grosz, provider_payment_id')
    .eq('provider_checkout_id', session.id)
    .maybeSingle();

  let paymentId = metaPaymentId;
  if (paymentByCheckout) {
    if (paymentByCheckout.order_id !== order.id) {
      return { ok: false, error: 'session_mismatch' };
    }
    paymentId = paymentId ?? (paymentByCheckout.id as string);
  }

  if (!paymentId) {
    const { data: latest } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', order.id)
      .eq('provider', 'stripe')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    paymentId = latest?.id ?? null;
  }

  if (!paymentId) {
    return { ok: false, error: 'payment_not_found' };
  }

  const pi =
    typeof session.payment_intent === 'object' && session.payment_intent
      ? session.payment_intent
      : null;
  const piId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (pi?.id ?? null);

  const stripePaid =
    session.payment_status === 'paid' || pi?.status === 'succeeded';

  // Async methods: session may be complete while payment is still settling.
  const stripeProcessing =
    !stripePaid &&
    (pi?.status === 'processing' ||
      (session.status === 'complete' && session.payment_status === 'unpaid'));

  if (!stripePaid) {
    if (stripeProcessing) {
      await supabase
        .from('payments')
        .update({
          failure_message: 'stripe_checkout_reconciling',
          provider_checkout_id: session.id,
          provider_payment_id: piId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      return { ok: true, status: 'pending' };
    }
    return { ok: true, status: 'unpaid' };
  }

  const amount = session.amount_total ?? pi?.amount ?? 0;
  const currency = session.currency ?? pi?.currency ?? '';

  // Stable synthetic event id — distinct from Stripe evt_*; webhook remains idempotent.
  const reconcileEventId = `return_reconcile_${session.id}`;

  const { data: confirmResult, error: confirmError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('confirm_order_from_stripe', {
    p_order_id: order.id,
    p_payment_id: paymentId,
    p_stripe_event_id: reconcileEventId,
    p_provider_checkout_id: session.id,
    p_provider_payment_id: piId ?? '',
    p_amount_gross_grosz: amount,
    p_currency: currency,
    p_livemode: Boolean(session.livemode),
  });

  if (confirmError) {
    console.error('reconcile: confirm_order_from_stripe failed', confirmError);
    return { ok: false, error: 'confirm_failed' };
  }

  const result = (confirmResult ?? {}) as {
    status?: string;
    already_processed?: boolean;
  };

  await supabase
    .from('payments')
    .update({
      provider_checkout_id: session.id,
      provider_payment_id: piId,
      livemode: Boolean(session.livemode),
      failure_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  await suppressAwaitingStripeEmails(order.id);

  if (result.already_processed) {
    return { ok: true, status: 'already_paid' };
  }

  if (result.status === 'confirmed') {
    try {
      const { notifyOrderPaymentReceived } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentReceived(order.id);
    } catch (err) {
      console.error('reconcile: payment_received email failed', err);
    }
    return { ok: true, status: 'confirmed' };
  }

  if (result.status === 'requires_manual_resolution') {
    return { ok: false, error: 'manual_resolution' };
  }

  return { ok: true, status: 'pending' };
}

async function suppressAwaitingStripeEmails(orderId: string): Promise<void> {
  const supabase = createCartAdminClient();
  await supabase
    .from('order_emails')
    .update({
      status: 'sent',
      error_message: 'skipped_reconciled',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('email_type', ['awaiting_stripe_payment', 'customer_confirmation'])
    .in('status', ['pending', 'failed']);
}
