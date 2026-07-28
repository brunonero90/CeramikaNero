'use server';

import { createHash } from 'node:crypto';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { createOrReuseOrderCheckoutSession } from '@/lib/cart/order-checkout';

function hashLookupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type StartOrderPaymentResult =
  { ok: true; checkoutUrl: string } | { ok: false; error: string };

/**
 * Start Stripe Checkout for an unpaid order identified by opaque public token.
 * Amounts are re-read from Supabase — never from the browser.
 */
export async function startOrderStripePayment(
  publicLookupToken: string
): Promise<StartOrderPaymentResult> {
  const trimmed = publicLookupToken.trim();
  if (!/^[a-f0-9]{32,128}$/i.test(trimmed)) {
    return { ok: false, error: 'Nieprawidłowy link zamówienia.' };
  }

  const hash = hashLookupToken(trimmed);
  const supabase = createCartAdminClient();

  let { data: order, error } = await supabase
    .from('orders')
    .select(
      'id, payment_status, status, shipping_quote_required, selected_payment_method, total_gross_grosz'
    )
    .eq('public_lookup_token_hash', hash)
    .maybeSingle();

  if (error?.message?.includes('selected_payment_method')) {
    ({ data: order, error } = await supabase
      .from('orders')
      .select(
        'id, payment_status, status, shipping_quote_required, total_gross_grosz'
      )
      .eq('public_lookup_token_hash', hash)
      .maybeSingle());
  }

  if (error || !order) {
    return { ok: false, error: 'Nie znaleziono zamówienia.' };
  }

  if (order.shipping_quote_required) {
    return {
      ok: false,
      error: 'Płatność będzie dostępna po potwierdzeniu kosztu wysyłki.',
    };
  }

  if (order.payment_status === 'paid') {
    return { ok: false, error: 'Zamówienie jest już opłacone.' };
  }

  if (
    order.status === 'cancelled' ||
    order.status === 'expired' ||
    order.status === 'refunded'
  ) {
    return { ok: false, error: 'Zamówienie nie przyjmuje już płatności.' };
  }

  const session = await createOrReuseOrderCheckoutSession({
    orderId: order.id,
    publicLookupToken: trimmed,
  });

  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  return { ok: true, checkoutUrl: session.checkoutUrl };
}
