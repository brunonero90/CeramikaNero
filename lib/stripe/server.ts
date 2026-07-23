import 'server-only';
import Stripe from 'stripe';

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return key;
}

export function getStripeWebhookSecret(): string {
  const key = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return key;
}

export function getStripeServerClient(): Stripe {
  return new Stripe(getStripeSecretKey());
}
