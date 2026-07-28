import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { createEntityStripeCheckoutSession } from '@/lib/payments/stripe-checkout';
import { isStripeConfigured } from '@/lib/booking/local-mode';

function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SITE_URL is not configured');
  }
  return url.replace(/\/$/, '');
}

export type OrderCheckoutSessionResult =
  | {
      ok: true;
      checkoutUrl: string;
      paymentId: string;
      sessionId: string;
      reused: boolean;
    }
  | { ok: false; error: string };

const ACTIVE_PAYMENT_STATUSES = new Set(['created', 'pending']);

/**
 * Create or reuse a Stripe Checkout session for a server-authoritative order.
 * Re-reads amounts from Supabase. Never trusts browser totals.
 */
export async function createOrReuseOrderCheckoutSession(input: {
  orderId: string;
  publicLookupToken?: string;
}): Promise<OrderCheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error: 'Płatność online jest tymczasowo niedostępna.',
    };
  }

  const supabase = createCartAdminClient();
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_reference,
      status,
      payment_status,
      total_gross_grosz,
      shipping_quote_required,
      selected_payment_method,
      customer_profiles (email),
      order_items (title_snapshot, quantity)
    `
    )
    .eq('id', input.orderId)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: 'Nie znaleziono zamówienia.' };
  }

  if (order.shipping_quote_required) {
    return {
      ok: false,
      error:
        'Koszt wysyłki nie jest jeszcze potwierdzony — płatność online będzie dostępna po wycenie.',
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

  const total = Number(order.total_gross_grosz);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: 'Kwota zamówienia jest nieprawidłowa.' };
  }

  const profile = order.customer_profiles as { email: string } | null;
  if (!profile?.email) {
    return { ok: false, error: 'Brak adresu e-mail zamówienia.' };
  }

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, status, provider, provider_checkout_id, amount_gross_grosz, idempotency_key'
    )
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  const existingStripe = (payments ?? []).find(
    (p: {
      provider: string;
      status: string;
      provider_checkout_id: string | null;
      id: string;
    }) =>
      p.provider === 'stripe' &&
      ACTIVE_PAYMENT_STATUSES.has(String(p.status)) &&
      p.provider_checkout_id
  );

  if (existingStripe?.provider_checkout_id) {
    try {
      const { getStripeServerClient } = await import('@/lib/stripe/server');
      const stripe = getStripeServerClient();
      const session = await stripe.checkout.sessions.retrieve(
        existingStripe.provider_checkout_id
      );
      if (
        session.status === 'open' &&
        session.url &&
        Number(session.amount_total) === total
      ) {
        return {
          ok: true,
          checkoutUrl: session.url,
          paymentId: existingStripe.id,
          sessionId: session.id,
          reused: true,
        };
      }
    } catch (err) {
      console.error('reuse checkout session failed', err);
    }
  }

  let paymentId = (payments ?? []).find(
    (p: { status: string; amount_gross_grosz: number; id: string }) =>
      ACTIVE_PAYMENT_STATUSES.has(String(p.status)) &&
      Number(p.amount_gross_grosz) === total
  )?.id;

  if (!paymentId) {
    const { data: inserted, error: insertError } = await supabase
      .from('payments')
      .insert({
        booking_id: null,
        order_id: order.id,
        provider: 'stripe',
        status: 'created',
        amount_gross_grosz: total,
        currency: 'PLN',
        idempotency_key: `order-pay-${order.id}-${total}-${Date.now()}`,
      })
      .select('id')
      .maybeSingle();
    if (insertError || !inserted?.id) {
      console.error('order payment insert failed', insertError?.message);
      return { ok: false, error: 'Nie udało się przygotować płatności.' };
    }
    paymentId = inserted.id as string;
  } else {
    await supabase
      .from('payments')
      .update({
        provider: 'stripe',
        status: 'created',
        amount_gross_grosz: total,
        failure_code: null,
        failure_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);
  }

  const items = (order.order_items ?? []) as Array<{
    title_snapshot: string;
    quantity: number;
  }>;
  const lineName =
    items.length === 1
      ? items[0].title_snapshot
      : `Zamówienie ${order.order_reference}`;
  const lineDescription =
    items.length > 1
      ? items.map((i) => `${i.title_snapshot} × ${i.quantity}`).join(', ')
      : `Zamówienie ${order.order_reference}`;

  const siteUrl = getSiteUrl();
  const token = input.publicLookupToken;
  const successUrl = token
    ? `${siteUrl}/zamowienie/${encodeURIComponent(token)}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    : `${siteUrl}/cart/sukces?reference=${encodeURIComponent(order.order_reference)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = token
    ? `${siteUrl}/zamowienie/${encodeURIComponent(token)}?checkout=cancelled`
    : `${siteUrl}/cart?checkout=cancelled`;

  let session;
  try {
    session = await createEntityStripeCheckoutSession({
      entityType: 'order',
      entityId: order.id,
      paymentId,
      reference: order.order_reference,
      totalGrosz: total,
      lineItemName: lineName.slice(0, 120),
      lineItemDescription: lineDescription.slice(0, 500),
      customerEmail: profile.email,
      successUrl,
      cancelUrl,
    });
  } catch (err) {
    console.error('order stripe checkout create failed', err);
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        failure_message: 'Stripe Checkout session creation failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);
    return {
      ok: false,
      error: 'Nie udało się otworzyć płatności online. Spróbuj ponownie.',
    };
  }

  if (!session.url) {
    return { ok: false, error: 'Stripe nie zwrócił adresu płatności.' };
  }

  const expiresAtIso = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 30 * 60 * 1000).toISOString();

  await supabase
    .from('payments')
    .update({
      provider: 'stripe',
      status: 'pending',
      provider_checkout_id: session.id,
      idempotency_key: `checkout-${paymentId}`,
      amount_gross_grosz: total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  await supabase
    .from('orders')
    .update({
      selected_payment_method: 'stripe',
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Keep workshop holds valid for the Checkout window (Stripe min 30 min).
  await supabase
    .from('bookings')
    .update({
      expires_at: expiresAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', order.id)
    .in('status', ['pending', 'awaiting_payment']);

  return {
    ok: true,
    checkoutUrl: session.url,
    paymentId,
    sessionId: session.id,
    reused: false,
  };
}
