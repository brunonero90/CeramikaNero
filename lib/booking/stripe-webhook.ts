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

async function confirmFromPayment(
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

async function notifyConfirmOutcome(
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

function paymentIntentIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

async function handlePaidCheckoutSession(
  supabase: AdminClient,
  event: Stripe.Event,
  session: Stripe.Checkout.Session
): Promise<StripeWebhookResult> {
  const bookingId = session.metadata?.booking_id;
  const paymentId = session.metadata?.payment_id;
  if (!bookingId || !paymentId) {
    return { ok: false, status: 400, error: 'Missing metadata' };
  }

  const amount = session.amount_total ?? 0;
  const paymentIntentId = paymentIntentIdFromSession(session);

  const confirmed = await confirmFromPayment(supabase, {
    bookingId,
    paymentId,
    eventId: event.id,
    providerPaymentId: paymentIntentId ?? '',
    amountGrossGrosz: amount,
  });

  if (!confirmed.ok) {
    return { ok: false, status: 500, error: confirmed.error };
  }

  await notifyConfirmOutcome(bookingId, confirmed.result);
  return { ok: true };
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
  } = {
    provider_checkout_id: session.id,
  };
  if (paymentIntentId) {
    patch.provider_payment_id = paymentIntentId;
  }

  await supabase.from('payments').update(patch).eq('id', paymentId);
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
  const bookingId = session.metadata?.booking_id;
  if (bookingId) {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('id', bookingId)
      .single();

    if (booking?.status === 'pending') {
      await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId,
        p_cancelled_by: 'system',
        p_reason: 'Stripe Checkout session expired',
      });
    }
  }

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_message: 'Checkout session expired',
    })
    .eq('provider_checkout_id', session.id);
}

async function handleAsyncPaymentFailed(
  supabase: AdminClient,
  session: Stripe.Checkout.Session
): Promise<void> {
  const bookingId = session.metadata?.booking_id;

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      failure_message: 'Async Checkout payment failed',
    })
    .eq('provider_checkout_id', session.id);

  if (!bookingId) return;

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();

  if (booking?.status === 'pending') {
    await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
      p_cancelled_by: 'system',
      p_reason: 'Stripe async Checkout payment failed',
    });
  }
}

async function findPaymentForIntent(
  supabase: AdminClient,
  paymentIntent: Stripe.PaymentIntent
): Promise<{
  id: string;
  booking_id: string;
  amount_gross_grosz: number;
  status: string;
} | null> {
  const { data: byIntent } = await supabase
    .from('payments')
    .select('id, booking_id, amount_gross_grosz, status')
    .eq('provider_payment_id', paymentIntent.id)
    .maybeSingle();

  if (byIntent) return byIntent;

  const paymentId = paymentIntent.metadata?.payment_id;
  if (!paymentId) return null;

  const { data: byMeta } = await supabase
    .from('payments')
    .select('id, booking_id, amount_gross_grosz, status')
    .eq('id', paymentId)
    .maybeSingle();

  return byMeta;
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

  const confirmed = await confirmFromPayment(supabase, {
    bookingId: payment.booking_id,
    paymentId: payment.id,
    eventId: event.id,
    providerPaymentId: paymentIntent.id,
    amountGrossGrosz: payment.amount_gross_grosz,
  });

  if (!confirmed.ok) {
    return { ok: false, status: 500, error: confirmed.error };
  }

  await notifyConfirmOutcome(payment.booking_id, confirmed.result);
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
  };

  await supabase
    .from('payments')
    .update(update)
    .eq('provider_payment_id', paymentIntent.id);

  const paymentId = paymentIntent.metadata?.payment_id;
  if (paymentId) {
    await supabase.from('payments').update(update).eq('id', paymentId);
  }

  const checkoutSessionId = paymentIntent.metadata?.checkout_session_id ?? null;
  if (checkoutSessionId) {
    await supabase
      .from('payments')
      .update(update)
      .eq('provider_checkout_id', checkoutSessionId);
  }
}

/**
 * Processes a verified Stripe event. Callers must verify the signature on the
 * raw request body before invoking this function.
 */
export async function processStripeEvent(
  supabase: AdminClient,
  event: Stripe.Event
): Promise<StripeWebhookResult> {
  const alreadyProcessed = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (alreadyProcessed.data) {
    return { ok: true, duplicate: true };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handleCheckoutSessionCompleted(
        supabase,
        event,
        session
      );
      if (!result.ok) return result;
      break;
    }
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await handlePaidCheckoutSession(supabase, event, session);
      if (!result.ok) return result;
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
      const result = await handlePaymentIntentSucceeded(
        supabase,
        event,
        paymentIntent
      );
      if (!result.ok) return result;
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentFailed(supabase, paymentIntent);
      break;
    }
    case 'charge.refunded': {
      // Refunds are recorded by admin/customer flows after Stripe.refunds.create
      // succeeds. Acknowledge the event for idempotency only.
      break;
    }
    default:
      break;
  }

  // confirm_booking_from_payment may already have inserted this event_id.
  // Upsert ignoreDuplicates keeps webhook acknowledgements idempotent.
  await recordStripeEvent(supabase, event);
  return { ok: true };
}
