'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';
import { parsePlnToGrosz } from '@/lib/payments/admin-money';
import { createStripeRefund } from '@/lib/booking/payment';
import { requiresExternalRefundConfirmation } from '@/lib/payments/order-refund-policy';

const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
] as const;

const FULFILLMENT_STATUSES = [
  'unfulfilled',
  'partial',
  'fulfilled',
  'cancelled',
] as const;

const ORDER_STATUSES = [
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
] as const;

export async function setOrderShippingQuoteAction(
  formData: FormData
): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);

  const orderId = String(formData.get('orderId') ?? '');
  const feeRaw = String(formData.get('shippingFeePln') ?? '').trim();
  const shippingGrosz = parsePlnToGrosz(feeRaw);

  if (!orderId || shippingGrosz === null) {
    throw new Error('Nieprawidłowa wycena wysyłki.');
  }

  const supabase = createCartAdminClient();
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('set_order_shipping_quote', {
    p_order_id: orderId,
    p_shipping_gross_grosz: shippingGrosz,
    p_actor_id: admin.userId,
    p_actor_role: admin.role,
  });

  if (error) {
    console.error('set_order_shipping_quote failed', error.message);
    throw new Error('Nie udało się zapisać kosztu wysyłki.');
  }

  if (!(data as { already_confirmed?: boolean } | null)?.already_confirmed) {
    try {
      const { notifyShippingQuoteConfirmed } =
        await import('@/lib/cart/order-email');
      await notifyShippingQuoteConfirmed(orderId);
    } catch (err) {
      console.error('shipping quote email failed', err);
    }
  }

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  redirect(`/admin/zamowienia/${orderId}`);
}

export async function updateOrderOperationalStateAction(
  formData: FormData
): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const orderId = String(formData.get('orderId') ?? '');
  const paymentStatus = String(formData.get('paymentStatus') ?? '');
  const fulfillmentStatus = String(formData.get('fulfillmentStatus') ?? '');
  const orderStatus = String(formData.get('orderStatus') ?? '');
  const internalNotes = String(formData.get('internalNotes') ?? '');
  const trackingReference = String(formData.get('trackingReference') ?? '')
    .trim()
    .slice(0, 200);

  if (
    !orderId ||
    !PAYMENT_STATUSES.includes(
      paymentStatus as (typeof PAYMENT_STATUSES)[number]
    ) ||
    !FULFILLMENT_STATUSES.includes(
      fulfillmentStatus as (typeof FULFILLMENT_STATUSES)[number]
    ) ||
    !ORDER_STATUSES.includes(orderStatus as (typeof ORDER_STATUSES)[number])
  ) {
    throw new Error('Nieprawidłowy status zamówienia.');
  }

  const supabase = createCartAdminClient();
  const { data: previous } = await supabase
    .from('orders')
    .select(
      'payment_status, fulfillment_status, fulfillment_method, status, selected_payment_method'
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!previous) {
    throw new Error('Nie znaleziono zamówienia.');
  }

  const markingPaid =
    previous.payment_status !== 'paid' && paymentStatus === 'paid';
  const cancelling =
    previous.status !== 'cancelled' && orderStatus === 'cancelled';

  if (markingPaid && cancelling) {
    throw new Error('Nie można jednocześnie opłacić i anulować zamówienia.');
  }

  if (markingPaid) {
    if (orderStatus !== 'confirmed') {
      throw new Error('Opłacone zamówienie musi mieć status potwierdzone.');
    }
    const { error: confirmError } = await (
      supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc('confirm_manual_order_payment', {
      p_order_id: orderId,
      p_actor_id: admin.userId,
      p_actor_role: admin.role,
    });
    if (confirmError) {
      console.error(
        'confirm_manual_order_payment failed',
        confirmError.message
      );
      throw new Error(
        previous.selected_payment_method === 'stripe'
          ? 'To zamówienie używa Stripe. Ręczne potwierdzenie płatności jest zablokowane.'
          : 'Nie udało się atomowo potwierdzić płatności.'
      );
    }
  } else if (cancelling) {
    if (paymentStatus !== 'cancelled' || fulfillmentStatus !== 'cancelled') {
      throw new Error(
        'Anulowane zamówienie musi mieć anulowaną płatność i realizację.'
      );
    }
    const { error: cancelError } = await (
      supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc('cancel_unpaid_order', {
      p_order_id: orderId,
      p_actor_id: admin.userId,
      p_actor_role: admin.role,
      p_reason: 'Order cancelled by administrator',
    });
    if (cancelError) {
      console.error('cancel_unpaid_order failed', cancelError.message);
      throw new Error(
        'Nie można automatycznie anulować opłaconego lub częściowo zrealizowanego zamówienia.'
      );
    }
  } else if (
    paymentStatus !== previous.payment_status ||
    orderStatus !== previous.status
  ) {
    throw new Error(
      'Ta zmiana finansowa wymaga dedykowanej operacji płatności, anulowania lub zwrotu.'
    );
  }

  const patch: Record<string, unknown> = {
    fulfillment_status: fulfillmentStatus,
    internal_notes: internalNotes || null,
    tracking_reference: trackingReference || null,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from('orders').update(patch).eq('id', orderId);

  // Migration 14 may not be applied yet — retry without tracking column.
  if (error?.message?.includes('tracking_reference')) {
    delete patch.tracking_reference;
    ({ error } = await supabase.from('orders').update(patch).eq('id', orderId));
  }

  if (error) {
    console.error('order state update failed', error.message);
    throw new Error('Nie udało się zaktualizować zamówienia.');
  }

  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'status_updated',
    actor_type: 'admin',
    actor_id: admin.userId,
    metadata: {
      payment_status: paymentStatus,
      fulfillment_status: fulfillmentStatus,
      status: orderStatus,
      tracking_reference: trackingReference || null,
    },
  });

  if (previous?.payment_status !== 'paid' && paymentStatus === 'paid') {
    try {
      const { notifyOrderPaymentReceived } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentReceived(orderId);
    } catch (err) {
      console.error('payment received email failed', err);
    }
  }

  if (
    previous?.fulfillment_status !== 'fulfilled' &&
    fulfillmentStatus === 'fulfilled'
  ) {
    try {
      const { notifyOrderFulfilmentUpdate } =
        await import('@/lib/cart/order-email');
      await notifyOrderFulfilmentUpdate(
        orderId,
        previous?.fulfillment_method === 'shipping'
          ? 'order_shipped'
          : 'ready_for_pickup'
      );
    } catch (err) {
      console.error('fulfilment email failed', err);
    }
  }

  if (previous?.status !== 'cancelled' && orderStatus === 'cancelled') {
    try {
      const { notifyOrderCancellation } =
        await import('@/lib/cart/order-email');
      await notifyOrderCancellation(orderId);
    } catch (err) {
      console.error('cancellation email failed', err);
    }
  }

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  redirect(`/admin/zamowienia/${orderId}`);
}

export async function setOrderAnalyticsExcludedAction(
  formData: FormData
): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const orderId = String(formData.get('orderId') ?? '');
  const excluded = String(formData.get('excluded') ?? '') === '1';
  const reason = String(formData.get('reason') ?? '')
    .trim()
    .slice(0, 200);

  if (!orderId) throw new Error('Brak zamówienia.');

  const { rpcSetAnalyticsExcluded } =
    await import('@/lib/admin/session-cockpit');
  const { recordAuditEventWithCurrentClient } =
    await import('@/lib/admin/audit');

  const result = await rpcSetAnalyticsExcluded({
    entityType: 'order',
    entityId: orderId,
    excluded,
    reason: excluded ? reason || 'manual_exclusion' : null,
    actorUserId: admin.userId,
  });
  if (!result.ok) throw new Error(result.error);

  await recordAuditEventWithCurrentClient({
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: excluded ? 'analytics.exclude' : 'analytics.include',
    entityType: 'order',
    entityId: orderId,
    summary: excluded
      ? 'Order excluded from default analytics'
      : 'Order included in default analytics',
    changedFields: { excluded, hasReason: Boolean(reason) },
  });

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  revalidatePath('/admin/analityka');
  redirect(`/admin/zamowienia/${orderId}`);
}

export async function refundOrderAction(formData: FormData): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const orderId = String(formData.get('orderId') ?? '');
  const reason = String(formData.get('reason') ?? '')
    .trim()
    .slice(0, 1000);
  const operationKey = String(formData.get('operationKey') ?? '').trim();
  const manualRefundConfirmed = formData.get('manualRefundConfirmed') === 'on';

  if (
    !orderId ||
    !reason ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      operationKey
    )
  ) {
    throw new Error('Nieprawidłowe dane zwrotu.');
  }

  const supabase = createCartAdminClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, payment_status, fulfillment_status, total_gross_grosz')
    .eq('id', orderId)
    .maybeSingle();

  if (
    !order ||
    !['paid', 'partially_refunded'].includes(order.payment_status) ||
    order.fulfillment_status !== 'unfulfilled'
  ) {
    throw new Error(
      'Pełny zwrot jest dostępny tylko dla opłaconego, niezrealizowanego zamówienia.'
    );
  }

  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, provider, status, provider_payment_id, amount_gross_grosz, refunded_amount_grosz'
    )
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payment || !['paid', 'partially_refunded'].includes(payment.status)) {
    throw new Error('Brak płatności dostępnej do zwrotu.');
  }
  if (
    requiresExternalRefundConfirmation(payment.provider) &&
    !manualRefundConfirmed
  ) {
    throw new Error(
      'Najpierw wykonaj zwrot poza systemem i potwierdź jego realizację.'
    );
  }

  const remaining = payment.amount_gross_grosz - payment.refunded_amount_grosz;
  if (
    remaining <= 0 ||
    payment.amount_gross_grosz !== order.total_gross_grosz
  ) {
    throw new Error('Saldo płatności wymaga ręcznej weryfikacji.');
  }

  let refundOperationKey = `refund-order-${payment.id}-${operationKey}`;
  let stripeRefundPending = false;
  if (payment.provider === 'stripe') {
    if (!payment.provider_payment_id) {
      throw new Error('Brak identyfikatora płatności Stripe.');
    }
    try {
      const stripeRefund = await createStripeRefund({
        paymentId: payment.id,
        paymentIntentId: payment.provider_payment_id,
        amountGrosz: remaining,
        reason,
        idempotencyKey: refundOperationKey,
      });
      if (
        stripeRefund.status === 'failed' ||
        stripeRefund.status === 'canceled'
      ) {
        throw new Error('Stripe returned a failed refund');
      }
      if (stripeRefund.status !== 'succeeded') {
        stripeRefundPending = true;
      } else {
        refundOperationKey = stripeRefund.id;
      }
    } catch (err) {
      console.error('order Stripe refund failed', err);
      throw new Error(
        'Zwrot przez Stripe nie powiódł się. Sprawdź Stripe przed ponowieniem.'
      );
    }
  }

  if (stripeRefundPending) {
    try {
      const { notifyOrderRefundEvent } = await import('@/lib/cart/order-email');
      await notifyOrderRefundEvent(orderId, 'refund_initiated', remaining);
    } catch (err) {
      console.error('refund initiated email failed', err);
    }
    revalidatePath('/admin/zamowienia');
    revalidatePath(`/admin/zamowienia/${orderId}`);
    redirect(`/admin/zamowienia/${orderId}`);
  }

  const { data: recorded, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('record_order_refund_safe', {
    p_order_id: orderId,
    p_payment_id: payment.id,
    p_refund_amount_grosz: remaining,
    p_expected_refunded_total_grosz: payment.amount_gross_grosz,
    p_reason: reason,
    p_operation_key: refundOperationKey,
    p_actor_id: admin.userId,
    p_actor_role: admin.role,
  });

  if (error) {
    console.error('record_order_refund_safe failed', error.message);
    throw new Error(
      'Zwrot został zlecony, ale zapis lokalny wymaga weryfikacji. Nie ponawiaj go przed sprawdzeniem Stripe.'
    );
  }

  const { recordAuditEventWithCurrentClient } =
    await import('@/lib/admin/audit');
  await recordAuditEventWithCurrentClient({
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'order.refunded',
    entityType: 'order',
    entityId: orderId,
    summary: 'Full unfulfilled order refund completed',
    changedFields: {
      refund_amount_grosz: remaining,
      hasReason: Boolean(reason),
      status: (recorded as { status?: string } | null)?.status ?? 'refunded',
    },
  });

  try {
    const { notifyOrderRefundEvent } = await import('@/lib/cart/order-email');
    await notifyOrderRefundEvent(orderId, 'refund_completed', remaining);
  } catch (err) {
    console.error('refund completed email failed', err);
  }

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  revalidatePath('/admin/analityka');
  redirect(`/admin/zamowienia/${orderId}`);
}
