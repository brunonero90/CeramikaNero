'use server';

import 'server-only';
import { publicBookingInputSchema } from '@/lib/database/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getRateLimitKeys,
  checkBookingRateLimit,
} from '@/lib/booking/rate-limit';
import { createStripeCheckoutSession } from '@/lib/booking/payment';
import { buildCheckoutUrls } from '@/lib/booking/urls';
import {
  sendBookingConfirmationEmail,
  getBookingEmailContext,
} from '@/lib/booking/email';
import type { Json } from '@/lib/database/types';

export type CreateBookingResult =
  | {
      ok: true;
      checkoutUrl: string;
      bookingReference: string;
      expiresAt: string;
    }
  | { ok: false; error?: string; fieldErrors?: Record<string, string[]> };

function parseFormData(formData: FormData): unknown {
  const entries = Array.from(formData.entries());
  const obj: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (key === 'participants') {
      if (!obj[key]) obj[key] = [];
      (obj[key] as unknown[]).push(JSON.parse(value as string));
      continue;
    }
    if (key === 'marketingConsent' || key === 'termsAccepted') {
      obj[key] = value === 'on' || value === 'true';
      continue;
    }
    obj[key] = value;
  }
  return obj;
}

export async function createBookingAndCheckout(
  formData: FormData
): Promise<CreateBookingResult> {
  const raw = parseFormData(formData);

  const parsed = publicBookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;

  // Honeypot / anti-bot check
  const honeypot = formData.get('website');
  if (honeypot && String(honeypot).trim() !== '') {
    return { ok: false, error: 'Spam detected.' };
  }

  // Rate limit
  const { ipKey, secondaryKey } = await getRateLimitKeys({
    sessionId: input.sessionId,
    email: input.purchaserEmail,
  });
  const limit = await checkBookingRateLimit(ipKey, secondaryKey);
  if (!limit.success) {
    return {
      ok: false,
      error: 'Zbyt wiele prób rezerwacji. Spróbuj ponownie za chwilę.',
    };
  }

  const supabase = createAdminClient();

  const participants = input.participants.map((p) => ({
    display_name: p.displayName,
    age: p.age ?? null,
    participant_type: p.participantType,
    accessibility_notes: p.accessibilityNotes ?? null,
  }));

  const { data: result, error: beginError } = await supabase.rpc(
    'begin_booking',
    {
      p_session_id: input.sessionId,
      p_quantity: input.quantity,
      p_customer_email: input.purchaserEmail,
      p_customer_first_name: input.purchaserFirstName,
      p_customer_last_name: input.purchaserLastName,
      p_customer_phone: input.purchaserPhone,
      p_customer_notes: input.customerNotes ?? '',
      p_marketing_consent: input.marketingConsent,
      p_terms_accepted_at: new Date().toISOString(),
      p_privacy_policy_version: input.privacyPolicyVersion,
      p_participants: participants as unknown as Json,
      p_source: 'website',
      p_payment_provider: 'stripe',
      p_payment_status: 'created',
    }
  );

  if (beginError || !result) {
    // Do not expose raw database errors to the browser
    console.error('begin_booking failed', beginError);
    return {
      ok: false,
      error:
        'Nie udało się zarezerwować miejsca. Sesja mogła zostać wykupiona lub dane są nieprawidłowe.',
    };
  }

  const reservation = result as unknown as {
    booking_id: string;
    payment_id: string;
    booking_reference: string;
    total_price_gross_grosz: number;
    amount_to_pay_gross_grosz: number;
    currency: string;
    expires_at: string;
    confirmed_at: string | null;
  };

  if (reservation.amount_to_pay_gross_grosz === 0) {
    // Free workshop (e.g. complimentary). Mark as confirmed directly.
    const { error: confirmError } = await supabase.rpc(
      'confirm_booking_from_payment',
      {
        p_booking_id: reservation.booking_id,
        p_payment_id: reservation.payment_id,
        p_stripe_event_id: 'manual-zero-payment',
        p_provider_payment_id: null,
        p_amount_gross_grosz: 0,
      }
    );
    if (!confirmError) {
      const ctx = await getBookingEmailContext(reservation.booking_id);
      if (ctx) {
        await sendBookingConfirmationEmail(ctx);
      }
      return {
        ok: true,
        checkoutUrl:
          '/rezerwacja/sukces?reference=' + reservation.booking_reference,
        bookingReference: reservation.booking_reference,
        expiresAt: reservation.expires_at,
      };
    }
  }

  // Fetch session/workshop details for the line item
  const { data: sessionData } = await supabase
    .from('workshop_sessions')
    .select('starts_at, workshops(title, slug)')
    .eq('id', input.sessionId)
    .single();

  const workshopTitle =
    (sessionData?.workshops as { title: string } | null)?.title ?? 'Warsztat';
  const sessionDate = sessionData?.starts_at
    ? new Date(sessionData.starts_at).toLocaleString('pl-PL')
    : 'termin';

  const { successUrl, cancelUrl } = buildCheckoutUrls(
    reservation.booking_reference
  );

  try {
    const stripeSession = await createStripeCheckoutSession({
      paymentId: reservation.payment_id,
      bookingId: reservation.booking_id,
      reference: reservation.booking_reference,
      totalGrosz: reservation.amount_to_pay_gross_grosz,
      currency: reservation.currency,
      lineItemName: workshopTitle,
      lineItemDescription: `${input.quantity} ${input.quantity === 1 ? 'uczestnik' : 'uczestników'} · ${sessionDate}`,
      customerEmail: input.purchaserEmail,
      successUrl,
      cancelUrl,
    });

    await supabase
      .from('payments')
      .update({
        provider_checkout_id: stripeSession.id,
        idempotency_key: `checkout-${reservation.payment_id}`,
      })
      .eq('id', reservation.payment_id);

    return {
      ok: true,
      checkoutUrl:
        stripeSession.url ??
        '/rezerwacja/anulowana?reference=' + reservation.booking_reference,
      bookingReference: reservation.booking_reference,
      expiresAt: reservation.expires_at,
    };
  } catch (stripeError) {
    console.error('Stripe checkout creation failed', stripeError);

    // Release the reserved capacity so the customer is not stuck
    await supabase.rpc('cancel_booking', {
      p_booking_id: reservation.booking_id,
      p_cancelled_by: 'system',
      p_reason: 'Stripe Checkout creation failed',
    });

    return {
      ok: false,
      error:
        'Nie udało się przygotować płatności. Rezerwacja została anulowana – spróbuj ponownie.',
    };
  }
}
