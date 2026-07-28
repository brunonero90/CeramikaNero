import 'server-only';
import type Stripe from 'stripe';
import { getStripeServerClient } from '@/lib/stripe/server';
import { CURRENCY } from '@/lib/booking/constants';

/** Stripe Checkout minimum expiry is 30 minutes from creation. */
export const STRIPE_CHECKOUT_EXPIRY_SECONDS = 30 * 60;

export type CheckoutEntityType = 'booking' | 'order';

export async function createEntityStripeCheckoutSession(params: {
  entityType: CheckoutEntityType;
  entityId: string;
  paymentId: string;
  reference: string;
  totalGrosz: number;
  lineItemName: string;
  lineItemDescription: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeServerClient();
  const idempotencyKey = `checkout-${params.paymentId}`;
  const expiresAt =
    Math.floor(Date.now() / 1000) + STRIPE_CHECKOUT_EXPIRY_SECONDS;

  const metadata: Record<string, string> = {
    entity_type: params.entityType,
    payment_id: params.paymentId,
  };

  if (params.entityType === 'booking') {
    metadata.booking_id = params.entityId;
    metadata.booking_reference = params.reference;
  } else {
    metadata.order_id = params.entityId;
    metadata.order_reference = params.reference;
  }

  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      // Omit payment_method_types — Dashboard dynamic methods control eligibility.
      line_items: [
        {
          price_data: {
            currency: CURRENCY.toLowerCase(),
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
