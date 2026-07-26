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
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle();

  const patch: Record<string, unknown> = {
    payment_status: paymentStatus,
    fulfillment_status: fulfillmentStatus,
    status: orderStatus,
    internal_notes: internalNotes || null,
    updated_at: new Date().toISOString(),
  };
  if (orderStatus === 'confirmed') {
    patch.confirmed_at = new Date().toISOString();
  }
  if (orderStatus === 'cancelled') {
    patch.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders')
    .update(patch)
    .eq('id', orderId);

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

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  redirect(`/admin/zamowienia/${orderId}`);
}
