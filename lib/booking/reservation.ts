'use server';

import 'server-only';
import { createHash } from 'node:crypto';
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
  sendLocalBookingConfirmationEmail,
} from '@/lib/booking/email';
import type { Json } from '@/lib/database/types';
import {
  isBookingLocalMode,
  isStripeConfigured,
} from '@/lib/booking/local-mode';
import { beginLocalBooking } from '@/lib/booking/local-store';
import { ensureLocalBookingSeed } from '@/lib/booking/local-seed';

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
      const parsed = JSON.parse(value as string) as unknown;
      obj[key] = Array.isArray(parsed) ? parsed : [parsed];
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

function bookingIdempotencyKey(input: {
  sessionId: string;
  email: string;
  quantity: number;
  firstName: string;
  lastName: string;
}): string {
  return createHash('sha256')
    .update(
      [
        input.sessionId,
        input.email.trim().toLowerCase(),
        String(input.quantity),
        input.firstName.trim().toLowerCase(),
        input.lastName.trim().toLowerCase(),
      ].join('|')
    )
    .digest('hex');
}

async function createLocalBookingAndConfirm(
  input: ReturnType<typeof publicBookingInputSchema.parse>
): Promise<CreateBookingResult> {
  await ensureLocalBookingSeed();

  const result = await beginLocalBooking({
    sessionId: input.sessionId,
    quantity: input.quantity,
    purchaserEmail: input.purchaserEmail,
    purchaserFirstName: input.purchaserFirstName,
    purchaserLastName: input.purchaserLastName,
    purchaserPhone: input.purchaserPhone,
    customerNotes: input.customerNotes,
    marketingConsent: input.marketingConsent,
    privacyPolicyVersion: input.privacyPolicyVersion,
    participants: input.participants.map((p) => ({
      displayName: p.displayName,
      age: p.age ?? null,
      participantType: p.participantType,
      accessibilityNotes: p.accessibilityNotes ?? null,
    })),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (!result.reused) {
    const location = [
      result.session.locationName,
      result.session.locationAddress,
    ]
      .filter(Boolean)
      .join(', ');

    await sendLocalBookingConfirmationEmail({
      bookingId: result.booking.id,
      reference: result.booking.bookingReference,
      workshopTitle: result.session.workshopTitle,
      sessionStartsAt: result.session.startsAt,
      sessionLocation: location,
      quantity: result.booking.quantity,
      totalGrossGrosz: result.booking.totalPriceGrossGrosz,
      customerEmail: result.booking.purchaserEmail,
      customerName:
        `${result.booking.purchaserFirstName} ${result.booking.purchaserLastName}`.trim(),
      participants: result.booking.participants.map((p) => ({
        display_name: p.displayName,
        age: p.age,
      })),
    });
  }

  return {
    ok: true,
    checkoutUrl:
      '/rezerwacja/sukces?reference=' +
      encodeURIComponent(result.booking.bookingReference) +
      '&local=1',
    bookingReference: result.booking.bookingReference,
    expiresAt: result.booking.createdAt,
  };
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

  const honeypot = formData.get('website');
  if (honeypot && String(honeypot).trim() !== '') {
    return { ok: false, error: 'Spam detected.' };
  }

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

  if (isBookingLocalMode()) {
    return createLocalBookingAndConfirm(input);
  }

  const supabase = createAdminClient();
  const useStripe = isStripeConfigured();
  const idempotencyKey = bookingIdempotencyKey({
    sessionId: input.sessionId,
    email: input.purchaserEmail,
    quantity: input.quantity,
    firstName: input.purchaserFirstName,
    lastName: input.purchaserLastName,
  });

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
      p_payment_provider: useStripe ? 'stripe' : 'bank_transfer',
      p_payment_status: useStripe ? 'created' : 'pending',
      p_status: useStripe ? 'pending' : 'awaiting_payment',
      p_idempotency_key: idempotencyKey,
    }
  );

  if (beginError || !result) {
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
    expires_at: string | null;
    confirmed_at: string | null;
    reused?: boolean;
  };

  // Bank-transfer / offline path when Stripe is not configured.
  if (!useStripe) {
    if (!reservation.reused) {
      const ctx = await getBookingEmailContext(reservation.booking_id);
      if (ctx) {
        await sendBookingConfirmationEmail(ctx);
      }
    }
    return {
      ok: true,
      checkoutUrl:
        '/rezerwacja/sukces?reference=' +
        encodeURIComponent(reservation.booking_reference) +
        '&payment=bank_transfer',
      bookingReference: reservation.booking_reference,
      expiresAt: reservation.expires_at ?? new Date().toISOString(),
    };
  }

  if (reservation.amount_to_pay_gross_grosz === 0) {
    const { error: confirmError } = await supabase.rpc(
      'confirm_booking_from_payment',
      {
        p_booking_id: reservation.booking_id,
        p_payment_id: reservation.payment_id,
        p_stripe_event_id: 'manual-zero-payment',
        p_provider_payment_id: '',
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
        expiresAt: reservation.expires_at ?? new Date().toISOString(),
      };
    }
  }

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
      expiresAt: reservation.expires_at ?? new Date().toISOString(),
    };
  } catch (stripeError) {
    console.error('Stripe checkout creation failed', stripeError);

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
