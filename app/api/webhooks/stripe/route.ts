import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import {
  getStripeServerClient,
  getStripeWebhookSecret,
} from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getRateLimitKeys,
  checkWebhookRateLimit,
} from '@/lib/booking/rate-limit';
import {
  sendBookingConfirmationEmail,
  sendPaymentProblemEmail,
  getBookingEmailContext,
} from '@/lib/booking/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const { ipKey } = await getRateLimitKeys({});
  const limit = await checkWebhookRateLimit(ipKey);
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  const stripe = getStripeServerClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  const alreadyProcessed = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle();
  if (alreadyProcessed.data) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        const paymentId = session.metadata?.payment_id;
        if (!bookingId || !paymentId) {
          return NextResponse.json(
            { error: 'Missing metadata' },
            { status: 400 }
          );
        }
        const amount = session.amount_total ?? 0;
        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : null;

        const { data: confirmResult, error: confirmError } = await supabase.rpc(
          'confirm_booking_from_payment',
          {
            p_booking_id: bookingId,
            p_payment_id: paymentId,
            p_stripe_event_id: event.id,
            p_provider_payment_id: paymentIntentId,
            p_amount_gross_grosz: amount,
          }
        );

        if (confirmError) {
          console.error('confirm_booking_from_payment failed', confirmError);
          return NextResponse.json(
            { error: 'Confirmation failed' },
            { status: 500 }
          );
        }

        const result = (confirmResult ?? {}) as {
          status?: string;
          recovered?: boolean;
        };
        const ctx = await getBookingEmailContext(bookingId);
        if (result.status === 'confirmed' && ctx) {
          await sendBookingConfirmationEmail(ctx);
        } else if (result.status === 'requires_manual_resolution' && ctx) {
          await sendPaymentProblemEmail(ctx);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

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
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_message: 'Checkout session expired',
          })
          .eq('provider_checkout_id', session.id);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;

        const { data: payment } = await supabase
          .from('payments')
          .select('id, booking_id, amount_gross_grosz, status')
          .eq('provider_payment_id', paymentIntentId)
          .single();

        if (!payment || payment.status === 'paid') {
          break;
        }

        const { data: confirmResult, error: confirmError } = await supabase.rpc(
          'confirm_booking_from_payment',
          {
            p_booking_id: payment.booking_id,
            p_payment_id: payment.id,
            p_stripe_event_id: event.id,
            p_provider_payment_id: paymentIntentId,
            p_amount_gross_grosz: payment.amount_gross_grosz,
          }
        );

        if (confirmError) {
          console.error('confirm_booking_from_payment failed', confirmError);
          return NextResponse.json(
            { error: 'Confirmation failed' },
            { status: 500 }
          );
        }

        const result = (confirmResult ?? {}) as {
          status?: string;
          recovered?: boolean;
        };
        const ctx = await getBookingEmailContext(payment.booking_id);
        if (result.status === 'confirmed' && ctx) {
          await sendBookingConfirmationEmail(ctx);
        } else if (result.status === 'requires_manual_resolution' && ctx) {
          await sendPaymentProblemEmail(ctx);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentIntentId = paymentIntent.id;
        const checkoutSessionId =
          paymentIntent.metadata?.checkout_session_id ?? null;

        const update = {
          status: 'failed' as const,
          failure_code: paymentIntent.last_payment_error?.code ?? null,
          failure_message:
            paymentIntent.last_payment_error?.message ?? 'Payment failed',
        };

        if (paymentIntentId) {
          await supabase
            .from('payments')
            .update(update)
            .eq('provider_payment_id', paymentIntentId);
        }
        if (checkoutSessionId) {
          await supabase
            .from('payments')
            .update(update)
            .eq('provider_checkout_id', checkoutSessionId);
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : null;
        if (!paymentIntentId) break;
        // The refund is recorded by the admin flow when it calls Stripe. We only
        // insert a stripe_events record here to acknowledge the event and keep
        // idempotency. This avoids double-counting refunded amounts.
        break;
      }

      default:
        break;
    }

    await supabase.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Webhook processing error';
    console.error('Stripe webhook error', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
