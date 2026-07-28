import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { isResendConfigured } from '@/lib/booking/local-mode';
import { notifyOrderCreated } from '@/lib/cart/order-email';

const MAX_ATTEMPTS = 8;

export type OrderEmailDispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  resendConfigured: boolean;
};

function backoffMs(attemptCount: number): number {
  const minutes = Math.min(60, Math.pow(2, Math.max(0, attemptCount)));
  return minutes * 60_000;
}

/**
 * Process pending/failed order_emails. Does not roll back orders on failure.
 * Prefer event-path sends; this worker recovers stuck/failed rows.
 */
export async function dispatchPendingOrderEmails(
  limit = 20
): Promise<OrderEmailDispatchSummary> {
  const summary: OrderEmailDispatchSummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    resendConfigured: isResendConfigured(),
  };

  const supabase = createCartAdminClient();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('order_emails')
    .select('id, order_id, email_type, recipient, status, attempt_count')
    .in('status', ['pending', 'failed'])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('order email claim failed', error.message);
    throw new Error('order email dispatch query failed');
  }

  for (const row of rows ?? []) {
    summary.claimed += 1;
    const attempts = Number(row.attempt_count ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      summary.skipped += 1;
      continue;
    }

    await supabase
      .from('order_emails')
      .update({
        claimed_at: now,
        updated_at: now,
      })
      .eq('id', row.id);

    // Rebuild/send via notify helpers for known types; otherwise generic retry.
    try {
      if (
        row.email_type === 'customer_confirmation' ||
        row.email_type === 'admin_notification' ||
        row.email_type === 'awaiting_stripe_payment' ||
        row.email_type === 'manual_transfer_requested'
      ) {
        await notifyOrderCreated(row.order_id);
      } else if (row.email_type === 'shipping_quote_confirmed') {
        const { notifyShippingQuoteConfirmed } =
          await import('@/lib/cart/order-email');
        await notifyShippingQuoteConfirmed(row.order_id);
      } else if (row.email_type === 'payment_received') {
        const { notifyOrderPaymentReceived } =
          await import('@/lib/cart/order-email');
        await notifyOrderPaymentReceived(row.order_id);
      } else if (
        row.email_type === 'ready_for_pickup' ||
        row.email_type === 'order_shipped'
      ) {
        const { notifyOrderFulfilmentUpdate } =
          await import('@/lib/cart/order-email');
        await notifyOrderFulfilmentUpdate(row.order_id, row.email_type);
      } else if (row.email_type === 'cancellation') {
        const { notifyOrderCancellation } =
          await import('@/lib/cart/order-email');
        await notifyOrderCancellation(row.order_id);
      } else if (row.email_type === 'stripe_payment_processing') {
        const { notifyOrderStripeProcessing } =
          await import('@/lib/cart/order-email');
        await notifyOrderStripeProcessing(row.order_id);
      } else if (
        row.email_type === 'payment_failed' ||
        row.email_type === 'checkout_expired'
      ) {
        const { notifyOrderPaymentFailed } =
          await import('@/lib/cart/order-email');
        await notifyOrderPaymentFailed(
          row.order_id,
          row.email_type as 'payment_failed' | 'checkout_expired'
        );
      } else if (row.email_type === 'admin_payment_problem') {
        const { notifyAdminOrderPaymentProblem } =
          await import('@/lib/cart/order-email');
        await notifyAdminOrderPaymentProblem(row.order_id);
      } else if (
        row.email_type === 'refund_initiated' ||
        row.email_type === 'refund_completed' ||
        row.email_type === 'refund_failed'
      ) {
        const { notifyOrderRefundEvent } =
          await import('@/lib/cart/order-email');
        await notifyOrderRefundEvent(
          row.order_id,
          row.email_type as
            'refund_initiated' | 'refund_completed' | 'refund_failed'
        );
      } else {
        // Unknown type — leave for manual review.
        summary.skipped += 1;
        continue;
      }

      const { data: refreshed } = await supabase
        .from('order_emails')
        .select('status')
        .eq('id', row.id)
        .maybeSingle();
      if (refreshed?.status === 'sent') summary.sent += 1;
      else {
        summary.failed += 1;
        await supabase
          .from('order_emails')
          .update({
            status: 'failed',
            attempt_count: attempts + 1,
            next_attempt_at: new Date(
              Date.now() + backoffMs(attempts + 1)
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    } catch (err) {
      summary.failed += 1;
      await supabase
        .from('order_emails')
        .update({
          status: 'failed',
          attempt_count: attempts + 1,
          error_message:
            err instanceof Error ? err.message.slice(0, 300) : 'unknown',
          next_attempt_at: new Date(
            Date.now() + backoffMs(attempts + 1)
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  return summary;
}
