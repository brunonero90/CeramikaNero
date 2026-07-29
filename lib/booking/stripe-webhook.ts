import 'server-only';
import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/generated-types';
import {
  sendBookingConfirmationEmail,
  sendPaymentProblemEmail,
  getBookingEmailContext,
} from '@/lib/booking/email';

type AdminClient = SupabaseClient<Database>;

export type StripeWebhookResult =
  | { ok: true; duplicate?: boolean }
  | { ok: false; status: number; error: string };

type ConfirmRpcResult = {
  status?: string;
  recovered?: boolean;
  already_processed?: boolean;
};

async function recordStripeEvent(
  supabase: AdminClient,
  event: Stripe.Event
): Promise<void> {
  await supabase.from('stripe_events').upsert(
    {
      event_id: event.id,
      event_type: event.type,
    },
    { onConflict: 'event_id', ignoreDuplicates: true }
  );
}

function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

function resolveEntity(session: Stripe.Checkout.Session): {
  entityType: 'order' | 'booking' | null;
  orderId: string | null;
  bookingId: string | null;
  paymentId: string | null;
} {
  const paymentId = session.metadata?.payment_id ?? null;
  const entityType = session.metadata?.entity_type;
  const orderId = session.metadata?.order_id ?? null;
  const bookingId = session.metadata?.booking_id ?? null;

  if (entityType === 'order' || orderId) {
    return { entityType: 'order', orderId, bookingId: null, paymentId };
  }
  if (entityType === 'booking' || bookingId) {
    return { entityType: 'booking', orderId: null, bookingId, paymentId };
  }
  return { entityType: null, orderId: null, bookingId: null, paymentId };
}

async function confirmFromBookingPayment(
  supabase: AdminClient,
  params: {
    bookingId: string;
    paymentId: string;
    eventId: string;
    providerPaymentId: string;
    amountGrossGrosz: number;
  }
): Promise<
  { ok: true; result: ConfirmRpcResult } | { ok: false; error: string }
> {
  const { data: confirmResult, error: confirmError } = await supabase.rpc(
    'confirm_booking_from_payment',
    {
      p_booking_id: params.bookingId,
      p_payment_id: params.paymentId,
      p_stripe_event_id: params.eventId,
      p_provider_payment_id: params.providerPaymentId,
      p_amount_gross_grosz: params.amountGrossGrosz,
    }
  );

  if (confirmError) {
    console.error('confirm_booking_from_payment failed', confirmError);
    return { ok: false, error: 'Confirmation failed' };
  }

  return { ok: true, result: (confirmResult ?? {}) as ConfirmRpcResult };
}

async function confirmFromOrderPayment(
  supabase: AdminClient,
  params: {
    orderId: string;
    paymentId: string;
    eventId: string;
    providerPaymentId: string;
    amountGrossGrosz: number;
  }
): Promise<
  { ok: true; result: ConfirmRpcResult } | { ok: false; error: string }
> {
  // RPC added in migration 15 — call via loosely typed client when types lag.
  const { data: confirmResult, error: confirmError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc('confirm_order_from_payment', {
    p_order_id: params.orderId,
    p_payment_id: params.paymentId,
    p_stripe_event_id: params.eventId,
    p_provider_payment_id: params.providerPaymentId,
    p_amount_gross_grosz: params.amountGrossGrosz,
  });

  if (confirmError) {
    console.error('confirm_order_from_payment failed', confirmError);
    return { ok: false, error: 'Order confirmation failed' };
  }

  return { ok: true, result: (confirmResult ?? {}) as ConfirmRpcResult };
}

async function notifyBookingConfirmOutcome(
  bookingId: string,
  result: ConfirmRpcResult
): Promise<void> {
  if (result.already_processed) return;
  const ctx = await getBookingEmailContext(bookingId);
  if (!ctx) return;
  if (result.status === 'confirmed') {
    await sendBookingConfirmationEmail(ctx);
  } else if (result.status === 'requires_manual_resolution') {
    await sendPaymentProblemEmail(ctx);
  }
}

async function notifyOrderConfirmOutcome(
  orderId: string,
  result: ConfirmRpcResult
): Promise<void> {
  if (result.already_processed) return;
  try {
    if (result.status === 'confirmed') {
      const { notifyOrderPaymentReceived } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentReceived(orderId);
    } else if (result.status === 'requires_manual_resolution') {
      const { notifyAdminOrderPaymentProblem } =
        await import('@/lib/cart/order-email');
      await notifyAdminOrderPaymentProblem(orderId);
    }
  } catch (err) {
    // Payment state already committed — email retries via outbox/cron.
    console.error('order payment email notify failed', err);
  }
}

async function handlePaidCheckoutSession(
  supabase: AdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<StripeWebhookResult> {
  let entity = resolveEntity(session);
  let paymentId = entity.paymentId;

  // Recover identifiers from the payments row when metadata is incomplete.
  if ((!entity.orderId && !entity.bookingId) || !paymentId) {
    try {
      const { createCartAdminClient } =
        await import('@/lib/supabase/cart-admin');
      const cart = createCartAdminClient();
      const { data: pay } = await cart
        .from('payments')
        .select('id, order_id, booking_id')
        .eq('provider_checkout_id', session.id)
        .maybeSingle();
      if (pay) {
        paymentId = paymentId ?? (pay.id as string);
        if (pay.order_id) {
          entity = {
            entityType: 'order',
            orderId: pay.order_id as string,
            bookingId: null,
            paymentId,
          };
        } else if (pay.booking_id) {
          entity = {
            entityType: 'booking',
            orderId: null,
            bookingId: pay.booking_id as string,
            paymentId,
          };
        }
      }
    } catch (err) {
      console.error('payment lookup by checkout id failed', err);
    }
  }

  if (!paymentId) {
    return { ok: false, status: 400, error: 'Missing metadata' };
  }

  const amount = session.amount_total ?? 0;
  const paymentIntentId = paymentIntentIdFromSession(session);

  if (entity.entityType === 'order' && entity.orderId) {
    const confirmed = await confirmFromOrderPayment(supabase, {
      orderId: entity.orderId,
      paymentId,
      eventId: event.id,
      providerPaymentId: paymentIntentId ?? '',
      amountGrossGrosz: amount,
    });
    if (!confirmed.ok) {
      return { ok: false, status: 500, error: confirmed.error };
    }
    await notifyOrderConfirmOutcome(entity.orderId, confirmed.result);
    return { ok: true };
  }

  if (entity.entityType === 'booking' && entity.bookingId) {
    const confirmed = await confirmFromBookingPayment(supabase, {
      bookingId: entity.bookingId,
      paymentId,
      eventId: event.id,
      providerPaymentId: paymentIntentId ?? '',
      amountGrossGrosz: amount,
    });
    if (!confirmed.ok) {
      return { ok: false, status: 500, error: confirmed.error };
    }
    await notifyBookingConfirmOutcome(entity.bookingId, confirmed.result);
    return { ok: true };
  }

  return { ok: false, status: 400, error: 'Missing metadata' };
}

async function handleUnpaidCheckoutSession(
  supabase: AdminClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) return;

  const paymentIntentId = paymentIntentIdFromSession(session);
  const patch: {
    provider_checkout_id: string;
    provider_payment_id?: string;
    status?: string;
    livemode?: boolean;
  } = {
    provider_checkout_id: session.id,
    livemode: Boolean(session.livemode),
  };
  if (paymentIntentId) {
    patch.provider_payment_id = paymentIntentId;
  }

  await (supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<unknown>;
      };
    };
  })
    .from('payments')
    .update(patch)
    .eq('id', paymentId);

  const entity = resolveEntity(session);
  if (entity.entityType === 'order' && entity.orderId) {
    try {
      const { notifyOrderStripeProcessing } =
        await import('@/lib/cart/order-email');
      await notifyOrderStripeProcessing(entity.orderId);
    } catch (err) {
      console.error('stripe processing email failed', err);
    }
  }
}

async function handleCheckoutSessionCompleted(
  supabase: AdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<StripeWebhookResult> {
  // Async methods (e.g. P24) can complete the session while payment is still
  // processing. Only confirm capacity when Stripe reports payment as paid.
  if (session.payment_status === 'paid') {
    return handlePaidCheckoutSession(supabase, event, session);
  }

  await handleUnpaidCheckoutSession(supabase, session);
  return { ok: true };
}

async function handleCheckoutSessionExpired(
  supabase: AdminClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const entity = resolveEntity(session);

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_message: 'Checkout session expired',
    })
    .eq('provider_checkout_id', session.id);

  if (entity.entityType === 'booking' && entity.bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', entity.bookingId)
      .single();

    if (booking?.status === 'pending') {
      await supabase.rpc('cancel_booking', {
        p_booking_id: entity.bookingId,
        p_cancelled_by: 'system',
        p_reason: 'Stripe Checkout session expired',
      });
    }
  }

  if (entity.entityType === 'order' && entity.orderId) {
    // Expiration affects only the unpaid attempt — keep order awaiting_payment.
    try {
      const { notifyOrderPaymentFailed } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentFailed(entity.orderId, 'checkout_expired');
    } catch (err) {
      console.error('checkout expired email failed', err);
    }
  }
}

async function handleAsyncPaymentFailed(
  supabase: AdminClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const entity = resolveEntity(session);

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_message: 'Async Checkout payment failed',
    })
    .eq('provider_checkout_id', session.id);

  if (entity.entityType === 'booking' && entity.bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', entity.bookingId)
      .single();

    if (booking?.status === 'pending') {
      await supabase.rpc('cancel_booking', {
        p_booking_id: entity.bookingId,
        p_cancelled_by: 'system',
        p_reason: 'Stripe async Checkout payment failed',
      });
    }
  }

  if (entity.entityType === 'order' && entity.orderId) {
    try {
      const { notifyOrderPaymentFailed } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentFailed(entity.orderId, 'payment_failed');
    } catch (err) {
      console.error('payment failed email failed', err);
    }
  }
}

async function findPaymentForIntent(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<{
  id: string;
  booking_id: string | null;
  order_id?: string | null;
  amount_gross_grosz: number;
  status: string;
} | null> {
  const paymentIdMeta = paymentIntent.metadata?.payment_id ?? null;
  const orderIdMeta = paymentIntent.metadata?.order_id ?? null;

  try {
    const { createCartAdminClient } = await import('@/lib/supabase/cart-admin');
    const cart = createCartAdminClient();

    const { data: byIntent } = await cart
      .from('payments')
      .select('id, booking_id, order_id, amount_gross_grosz, status')
      .eq('provider_payment_id', paymentIntent.id)
      .maybeSingle();

    if (byIntent) {
      return {
        id: byIntent.id as string,
        booking_id: (byIntent.booking_id as string | null) ?? null,
        order_id: (byIntent.order_id as string | null) ?? orderIdMeta ?? null,
        amount_gross_grosz: byIntent.amount_gross_grosz as number,
        status: byIntent.status as string,
      };
    }

    if (!paymentIdMeta) return null;

    const { data: byMeta } = await cart
      .from('payments')
      .select('id, booking_id, order_id, amount_gross_grosz, status')
      .eq('id', paymentIdMeta)
      .maybeSingle();

    if (!byMeta) return null;

    return {
      id: byMeta.id as string,
      booking_id: (byMeta.booking_id as string | null) ?? null,
      order_id: (byMeta.order_id as string | null) ?? orderIdMeta ?? null,
      amount_gross_grosz: byMeta.amount_gross_grosz as number,
      status: byMeta.status as string,
    };
  } catch (err) {
    console.error('findPaymentForIntent cart lookup failed', err);
    // Fall back to metadata-only path via typed admin client.
  }

  if (!paymentIdMeta) return null;

  const { data: byMetaAdmin } = await supabase
    .from('payments')
    .select('id, booking_id, amount_gross_grosz, status')
    .eq('id', paymentIdMeta)
    .maybeSingle();

  if (!byMetaAdmin) return null;

  return {
    id: byMetaAdmin.id,
    booking_id: byMetaAdmin.booking_id,
    order_id: orderIdMeta,
    amount_gross_grosz: byMetaAdmin.amount_gross_grosz,
    status: byMetaAdmin.status,
  };
}

async function handlePaymentIntentSucceeded(
  supabase: AdminClient,
  event: Stripe.Event,
  paymentIntent: Stripe.PaymentIntent
): Promise<StripeWebhookResult> {
  const payment = await findPaymentForIntent(supabase, paymentIntent);
  if (!payment || payment.status === 'paid') {
    return { ok: true };
  }

  const orderId = payment.order_id ?? paymentIntent.metadata?.order_id ?? null;
  const bookingId =
    payment.booking_id ?? paymentIntent.metadata?.booking_id ?? null;

  if (orderId) {
    const confirmed = await confirmFromOrderPayment(supabase, {
      orderId,
      paymentId: payment.id,
      eventId: event.id,
      providerPaymentId: paymentIntent.id,
      amountGrossGrosz: payment.amount_gross_grosz,
    });
    if (!confirmed.ok) {
      return { ok: false, status: 500, error: confirmed.error };
    }
    await notifyOrderConfirmOutcome(orderId, confirmed.result);
    return { ok: true };
  }

  if (!bookingId) {
    return { ok: true };
  }

  const confirmed = await confirmFromBookingPayment(supabase, {
    bookingId,
    paymentId: payment.id,
    eventId: event.id,
    providerPaymentId: paymentIntent.id,
    amountGrossGrosz: payment.amount_gross_grosz,
  });

  if (!confirmed.ok) {
    return { ok: false, status: 500, error: confirmed.error };
  }

  await notifyBookingConfirmOutcome(bookingId, confirmed.result);
  return { ok: true };
}

async function handlePaymentIntentFailed(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const update = {
    status: 'failed' as const,
    failure_code: paymentIntent.last_payment_error?.code ?? null,
    failure_message:
      paymentIntent.last_payment_error?.message ?? 'Payment failed',
    livemode: Boolean(paymentIntent.livemode),
  };

  const paymentsLoose = supabase as unknown as {
    from: (t: string) => {
      update: (p: Record<string, unknown>) => {
        eq: (
          c: string,
          v: string
        ) => Promise<unknown>;
      };
    };
  };

  await paymentsLoose
    .from('payments')
    .update(update)
    .eq('provider_payment_id', paymentIntent.id);

  const paymentId = paymentIntent.metadata?.payment_id;
  if (paymentId) {
    await paymentsLoose.from('payments').update(update).eq('id', paymentId);
  }

  const checkoutSessionId = paymentIntent.metadata?.checkout_session_id ?? null;
  if (checkoutSessionId) {
    await paymentsLoose
      .from('payments')
      .update(update)
      .eq('provider_checkout_id', checkoutSessionId);
  }

  const orderId = paymentIntent.metadata?.order_id;
  if (orderId) {
    try {
      const { notifyOrderPaymentFailed } =
        await import('@/lib/cart/order-email');
      await notifyOrderPaymentFailed(orderId, 'payment_failed');
    } catch (err) {
      console.error('payment intent failed email failed', err);
    }
  }
}

async function rpcLoose(
  supabase: AdminClient,
  name: string,
  args: Record<string, unknown>
): Promise<{ data: unknown; error: { message: string } | null }> {
  return (
    supabase as unknown as {
      rpc: (
        n: string,
        a: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc(name, args);
}

async function claimStripeEvent(
  supabase: AdminClient,
  event: Stripe.Event
): Promise<'claimed' | 'already_processed' | 'legacy_skip'> {
  const { data, error } = await rpcLoose(supabase, 'claim_stripe_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (!error && data && typeof data === 'object') {
    const status = (data as { status?: string }).status;
    if (status === 'already_processed') return 'already_processed';
    if (status === 'claimed') return 'claimed';
  }

  // Pre-migration-16 fallback: existence check (cannot retry failed inserts).
  const alreadyProcessed = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (alreadyProcessed.data) return 'already_processed';
  return 'legacy_skip';
}

async function completeStripeEvent(
  supabase: AdminClient,
  eventId: string,
  eventType: string
): Promise<void> {
  const { error } = await rpcLoose(supabase, 'complete_stripe_event', {
    p_event_id: eventId,
  });
  if (error) {
    await recordStripeEvent(supabase, {
      id: eventId,
      type: eventType,
    } as Stripe.Event);
  }
}

async function failStripeEvent(
  supabase: AdminClient,
  eventId: string,
  message: string
): Promise<void> {
  await rpcLoose(supabase, 'fail_stripe_event', {
    p_event_id: eventId,
    p_error: message,
  });
}

/**
 * Processes a verified Stripe event. Callers must verify the signature on the
 * raw request body before invoking this function.
 *
 * Events are claimed before processing. Failures return 5xx so Stripe retries.
 * Only successfully processed events are ignored on subsequent deliveries.
 */
export async function processStripeEvent(
  supabase: AdminClient,
  event: Stripe.Event
): Promise<StripeWebhookResult> {
  const claim = await claimStripeEvent(supabase, event);
  if (claim === 'already_processed') {
    return { ok: true, duplicate: true };
  }

  try {
    let result: StripeWebhookResult = { ok: true };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handleCheckoutSessionCompleted(supabase, event, session);
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handlePaidCheckoutSession(supabase, event, session);
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleAsyncPaymentFailed(supabase, session);
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionExpired(supabase, session);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        result = await handlePaymentIntentSucceeded(
          supabase,
          event,
          paymentIntent
        );
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(supabase, paymentIntent);
        break;
      }
      case 'charge.refunded': {
        break;
      }
      default:
        break;
    }

    if (!result.ok) {
      await failStripeEvent(supabase, event.id, result.error);
      return result;
    }

    await completeStripeEvent(supabase, event.id, event.type);
    // Legacy path when claim RPC missing: still record success.
    if (claim === 'legacy_skip') {
      await recordStripeEvent(supabase, event);
    }
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Webhook processing error';
    console.error('Stripe webhook processing threw', err);
    await failStripeEvent(supabase, event.id, message);
    return { ok: false, status: 500, error: message };
  }
}
