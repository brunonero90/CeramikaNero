import { NextResponse } from 'next/server';
import {
  getStripeServerClient,
  getStripeWebhookSecret,
} from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getRateLimitKeys,
  checkWebhookRateLimit,
} from '@/lib/booking/rate-limit';
import { processStripeEvent } from '@/lib/booking/stripe-webhook';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  // Signature verification requires the untouched raw body.
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
  let event;
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

  try {
    const result = await processStripeEvent(createAdminClient(), event);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }
    return NextResponse.json({
      received: true,
      ...(result.duplicate ? { duplicate: true } : {}),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Webhook processing error';
    console.error('Stripe webhook error', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
