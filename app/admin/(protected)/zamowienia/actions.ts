'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';

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

  revalidatePath('/admin/zamowienia');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  redirect(`/admin/zamowienia/${orderId}`);
}
