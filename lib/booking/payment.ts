import 'server-only';
import Stripe from 'stripe';
import { getStripeServerClient } from '@/lib/stripe/server';

export async function createStripeCheckoutSession(params: {
  paymentId: string;
  bookingId: string;
  reference: string;
  totalGrosz: number;
  currency: string;
  lineItemName: string;
  lineItemDescription: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeServerClient();
  const idempotencyKey = `checkout-${params.paymentId}`;
  // Stripe Checkout sessions require expires_at ≥ 30 minutes from creation.
  // Booking holds remain 15 minutes; late payments use manual-resolution paths.
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

  const metadata = {
    booking_id: params.bookingId,
    booking_reference: params.reference,
    payment_id: params.paymentId,
  };

  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      // Omit payment_method_types so Stripe Dashboard dynamic methods control
      // card / BLIK / Przelewy24 (and other eligible methods) without code changes.
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.lineItemName,
              description: params.lineItemDescription,
            },
            unit_amount: params.totalGrosz,
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: expiresAt,
      client_reference_id: params.reference,
      customer_email: params.customerEmail,
    },
    { idempotencyKey }
  );
}

export async function createStripeRefund(params: {
  paymentId: string;
  paymentIntentId: string;
  amountGrosz: number;
  reason: string;
  idempotencyKey: string;
}): Promise<Stripe.Refund> {
  const stripe = getStripeServerClient();
  return stripe.refunds.create(
    {
      payment_intent: params.paymentIntentId,
      amount: params.amountGrosz,
      reason: 'requested_by_customer',
      metadata: {
        payment_id: params.paymentId,
        internal_reason: params.reason,
      },
    },
    { idempotencyKey: params.idempotencyKey }
  );
}
