'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';

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
  const feePln = Number(feeRaw.replace(',', '.'));

  if (!orderId || !Number.isFinite(feePln) || feePln < 0) {
    throw new Error('Nieprawidłowa wycena wysyłki.');
  }

  const shippingGrosz = Math.round(feePln * 100);
  const supabase = createCartAdminClient();

  const { data: order, error: loadError } = await supabase
    .from('orders')
    .select('id, subtotal_gross_grosz')
    .eq('id', orderId)
    .maybeSingle();

  if (loadError || !order) {
    console.error('setOrderShippingQuote load failed', loadError?.message);
    throw new Error('Nie znaleziono zamówienia.');
  }

  const total = Number(order.subtotal_gross_grosz) + shippingGrosz;

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      shipping_gross_grosz: shippingGrosz,
      total_gross_grosz: total,
      shipping_quote_required: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    console.error('setOrderShippingQuote update failed', updateError.message);
    throw new Error('Nie udało się zapisać kosztu wysyłki.');
  }

  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'shipping_quote_confirmed',
    actor_type: 'admin',
    actor_id: admin.userId,
    metadata: {
      shipping_gross_grosz: shippingGrosz,
      total_gross_grosz: total,
      quoted_by: admin.displayName,
      quoted_by_email: admin.email,
    },
  });

  try {
    const { notifyShippingQuoteConfirmed } =
      await import('@/lib/cart/order-email');
    await notifyShippingQuoteConfirmed(orderId);
  } catch (err) {
    console.error('shipping quote email failed', err);
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

  // Manual "Mark paid" is for bank transfers only — never silently confirm Stripe.
  if (
    previous?.payment_status !== 'paid' &&
    paymentStatus === 'paid' &&
    (previous as { selected_payment_method?: string | null } | null)
      ?.selected_payment_method === 'stripe'
  ) {
    const { data: stripePayment } = await supabase
      .from('payments')
      .select('id, provider, status')
      .eq('order_id', orderId)
      .eq('provider', 'stripe')
      .maybeSingle();
    if (stripePayment && stripePayment.status !== 'paid') {
      throw new Error(
        'To zamówienie używa Stripe. Oznaczanie jako opłacone ręcznie jest zablokowane — poczekaj na webhook albo rozwiąż ręcznie po weryfikacji w Stripe.'
      );
    }
  }

  const patch: Record<string, unknown> = {
    payment_status: paymentStatus,
    fulfillment_status: fulfillmentStatus,
    status: orderStatus,
    internal_notes: internalNotes || null,
    tracking_reference: trackingReference || null,
    updated_at: new Date().toISOString(),
  };
  if (orderStatus === 'confirmed') {
    patch.confirmed_at = new Date().toISOString();
  }
  if (orderStatus === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
  }

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
      by: admin.displayName,
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
