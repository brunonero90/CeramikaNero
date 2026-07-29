import 'server-only';
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';
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
  | {
      ok: false;
      error: string;
      /** Order is paid or Stripe payment is complete and being reconciled. */
      code?: 'already_paid' | 'reconciling' | 'terminal' | 'not_eligible';
    };

const RETRYABLE_PAYMENT_STATUSES = new Set(['created', 'pending', 'failed']);

async function bindCheckoutSession(
  supabase: ReturnType<typeof createCartAdminClient>,
  input: {
    orderId: string;
    paymentId: string;
    totalGrosz: number;
    session: Stripe.Checkout.Session;
  }
): Promise<boolean> {
  const expiresAt = input.session.expires_at
    ? new Date(input.session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const { data, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('bind_order_checkout_session', {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_provider_checkout_id: input.session.id,
    p_expires_at: expiresAt,
    p_amount_gross_grosz: input.totalGrosz,
    p_currency: input.session.currency ?? 'pln',
    p_livemode: Boolean(input.session.livemode),
  });

  if (error || (data as { status?: string } | null)?.status !== 'bound') {
    console.error('bind_order_checkout_session failed', error?.message);
    return false;
  }
  return true;
}

/**
 * Create or reuse a Stripe Checkout session for a server-authoritative order.
 * Never creates a competing session when payment already succeeded at Stripe
 * or the local order is paid / reconciling.
 */
export async function createOrReuseOrderCheckoutSession(input: {
  orderId: string;
  publicLookupToken?: string;
}): Promise<OrderCheckoutSessionResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error: 'Płatność online jest tymczasowo niedostępna.',
      code: 'not_eligible',
    };
  }

  const supabase = createCartAdminClient();

  // Atomic eligibility claim (migration 16). Fall back to plain lock reads.
  type ClaimResult = {
    status?: string;
    payment_id?: string | null;
    provider_checkout_id?: string | null;
    amount_gross_grosz?: number;
  };
  let claim: ClaimResult | null = null;
  try {
    const { data: claimData, error: claimError } = await (
      supabase as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc('claim_order_checkout_attempt', { p_order_id: input.orderId });
    if (!claimError && claimData && typeof claimData === 'object') {
      claim = claimData as ClaimResult;
    }
  } catch {
    claim = null;
  }

  if (claim?.status === 'already_paid') {
    return {
      ok: false,
      error: 'Zamówienie jest już opłacone.',
      code: 'already_paid',
    };
  }
  if (claim?.status === 'reconciling') {
    return {
      ok: false,
      error:
        'Płatność jest już w trakcie potwierdzania. Odśwież stronę za chwilę.',
      code: 'reconciling',
    };
  }
  if (claim?.status === 'terminal') {
    return {
      ok: false,
      error: 'Zamówienie nie przyjmuje już płatności.',
      code: 'terminal',
    };
  }
  if (claim?.status === 'shipping_quote_required') {
    return {
      ok: false,
      error:
        'Koszt wysyłki nie jest jeszcze potwierdzony — płatność online będzie dostępna po wycenie.',
      code: 'not_eligible',
    };
  }

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
    return {
      ok: false,
      error: 'Nie znaleziono zamówienia.',
      code: 'not_eligible',
    };
  }

  if (order.shipping_quote_required) {
    return {
      ok: false,
      error:
        'Koszt wysyłki nie jest jeszcze potwierdzony — płatność online będzie dostępna po wycenie.',
      code: 'not_eligible',
    };
  }

  if (order.payment_status === 'paid') {
    return {
      ok: false,
      error: 'Zamówienie jest już opłacone.',
      code: 'already_paid',
    };
  }

  if (
    order.status === 'cancelled' ||
    order.status === 'expired' ||
    order.status === 'refunded'
  ) {
    return {
      ok: false,
      error: 'Zamówienie nie przyjmuje już płatności.',
      code: 'terminal',
    };
  }

  const total = Number(order.total_gross_grosz);
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ok: false,
      error: 'Kwota zamówienia jest nieprawidłowa.',
      code: 'not_eligible',
    };
  }

  const profile = order.customer_profiles as { email: string } | null;
  if (!profile?.email) {
    return {
      ok: false,
      error: 'Brak adresu e-mail zamówienia.',
      code: 'not_eligible',
    };
  }

  const { getStripeServerClient } = await import('@/lib/stripe/server');
  const stripe = getStripeServerClient();

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, status, provider, provider_checkout_id, provider_payment_id, amount_gross_grosz, failure_message'
    )
    .eq('order_id', order.id)
    .order('created_at', { ascending: false });

  type PayRow = {
    id: string;
    status: string;
    provider: string;
    provider_checkout_id: string | null;
    provider_payment_id: string | null;
    amount_gross_grosz: number;
    failure_message: string | null;
  };

  const rows = (payments ?? []) as PayRow[];

  // Any paid attempt → stop.
  if (rows.some((p) => p.status === 'paid')) {
    return {
      ok: false,
      error: 'Zamówienie jest już opłacone.',
      code: 'already_paid',
    };
  }

  // Inspect latest stripe checkout session at Stripe (authoritative).
  for (const p of rows) {
    if (p.provider !== 'stripe' || !p.provider_checkout_id) continue;
    try {
      const session = await stripe.checkout.sessions.retrieve(
        p.provider_checkout_id,
        { expand: ['payment_intent'] }
      );

      if (session.status === 'open' && session.url) {
        if (Number(session.amount_total) === total) {
          const bound = await bindCheckoutSession(supabase, {
            orderId: order.id,
            paymentId: p.id,
            totalGrosz: total,
            session,
          });
          if (!bound) {
            return {
              ok: false,
              error:
                'Nie udało się bezpiecznie powiązać płatności. Spróbuj ponownie.',
              code: 'not_eligible',
            };
          }
          return {
            ok: true,
            checkoutUrl: session.url,
            paymentId: p.id,
            sessionId: session.id,
            reused: true,
          };
        }
      }

      const pi =
        typeof session.payment_intent === 'object' && session.payment_intent
          ? session.payment_intent
          : null;
      const stripePaid =
        session.payment_status === 'paid' ||
        session.status === 'complete' ||
        pi?.status === 'succeeded' ||
        pi?.status === 'processing';

      if (stripePaid) {
        // Do NOT create a second session — webhook must reconcile.
        await supabase
          .from('payments')
          .update({
            failure_message: 'stripe_checkout_reconciling',
            provider_payment_id:
              (typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id) ?? p.provider_payment_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id);

        return {
          ok: false,
          error:
            'Stripe przyjął płatność. Czekamy na końcowe potwierdzenie — odśwież stronę za chwilę.',
          code: 'reconciling',
        };
      }

      // Expired / unpaid terminal session → allow new attempt below.
      if (
        session.status === 'expired' ||
        (session.status === 'complete' && session.payment_status !== 'paid')
      ) {
        if (RETRYABLE_PAYMENT_STATUSES.has(p.status)) {
          await supabase
            .from('payments')
            .update({
              status: 'failed',
              failure_message:
                session.status === 'expired'
                  ? 'Checkout session expired'
                  : 'Checkout completed unpaid',
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id);
        }
      }
    } catch (err) {
      console.error('stripe session inspect failed', err);
    }
  }

  // Also block if PaymentIntent already succeeded on a row.
  for (const p of rows) {
    if (!p.provider_payment_id) continue;
    try {
      const pi = await stripe.paymentIntents.retrieve(p.provider_payment_id);
      if (pi.status === 'succeeded' || pi.status === 'processing') {
        await supabase
          .from('payments')
          .update({
            failure_message: 'stripe_checkout_reconciling',
            updated_at: new Date().toISOString(),
          })
          .eq('id', p.id);
        return {
          ok: false,
          error:
            'Stripe przyjął płatność. Czekamy na końcowe potwierdzenie — odśwież stronę za chwilę.',
          code: 'reconciling',
        };
      }
    } catch {
      // Intent may not exist yet.
    }
  }

  // Migration 19 performs the final claim immediately before the Stripe API
  // call. This prevents two callers from generating competing fresh attempts,
  // while preserving one stable Stripe idempotency key after a process crash.
  const requestedAttemptKey = `checkout-order-${order.id}-${randomUUID()}`;
  const { data: preparedData, error: preparedError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('prepare_order_checkout_attempt', {
    p_order_id: order.id,
    p_attempt_key: requestedAttemptKey,
  });

  if (preparedError || !preparedData || typeof preparedData !== 'object') {
    console.error(
      'prepare_order_checkout_attempt failed',
      preparedError?.message
    );
    return {
      ok: false,
      error: 'Nie udało się przygotować płatności.',
      code: 'not_eligible',
    };
  }

  const prepared = preparedData as {
    status?: string;
    payment_id?: string;
    stripe_idempotency_key?: string;
  };
  if (prepared.status === 'already_paid') {
    return {
      ok: false,
      error: 'Zamówienie jest już opłacone.',
      code: 'already_paid',
    };
  }
  if (prepared.status === 'creating') {
    return {
      ok: false,
      error: 'Płatność jest już przygotowywana. Odśwież stronę za chwilę.',
      code: 'reconciling',
    };
  }
  if (
    prepared.status !== 'claimed' ||
    !prepared.payment_id ||
    !prepared.stripe_idempotency_key
  ) {
    return {
      ok: false,
      error: 'Zamówienie nie przyjmuje teraz płatności online.',
      code: prepared.status === 'terminal' ? 'terminal' : 'not_eligible',
    };
  }

  const paymentId = prepared.payment_id;

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

  const stripeIdempotencyKey = prepared.stripe_idempotency_key;

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
      idempotencyKey: stripeIdempotencyKey,
    });
  } catch (err) {
    console.error('order stripe checkout create failed', err);
    // Preserve the durable claim and its Stripe idempotency key. A network
    // exception can occur after Stripe created the Session; resetting the key
    // here could create a second payable Session on retry.
    return {
      ok: false,
      error: 'Nie udało się otworzyć płatności online. Spróbuj ponownie.',
      code: 'not_eligible',
    };
  }

  if (!session.url) {
    // Completed sessions often have null url — treat as reconciling if paid.
    if (session.payment_status === 'paid' || session.status === 'complete') {
      await supabase
        .from('payments')
        .update({
          provider_checkout_id: session.id,
          failure_message: 'stripe_checkout_reconciling',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      return {
        ok: false,
        error:
          'Stripe przyjął płatność. Czekamy na końcowe potwierdzenie — odśwież stronę za chwilę.',
        code: 'reconciling',
      };
    }
    await supabase
      .from('payments')
      .update({
        provider_checkout_id: session.id,
        status: 'failed',
        failure_code: 'checkout_not_payable',
        failure_message: 'Stripe Checkout session has no payable URL',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);
    return {
      ok: false,
      error: 'Stripe nie zwrócił adresu płatności.',
      code: 'not_eligible',
    };
  }

  const bound = await bindCheckoutSession(supabase, {
    orderId: order.id,
    paymentId,
    totalGrosz: total,
    session,
  });
  if (!bound) {
    return {
      ok: false,
      error:
        'Płatność została utworzona, ale wymaga bezpiecznego ponowienia. Nie płać z innej karty.',
      code: 'reconciling',
    };
  }

  return {
    ok: true,
    checkoutUrl: session.url,
    paymentId,
    sessionId: session.id,
    reused: false,
  };
}
