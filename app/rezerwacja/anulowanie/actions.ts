'use server';

import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getRateLimitKeys,
  checkCancelRateLimit,
} from '@/lib/booking/rate-limit';
import { isBookingActive } from '@/lib/booking/state';
import { createStripeRefund } from '@/lib/booking/payment';
import {
  sendBookingCancellationEmail,
  sendRefundEmail,
  getBookingEmailContext,
} from '@/lib/booking/email';
import { CANCELLATION_HOURS_BEFORE_SESSION } from '@/lib/booking/constants';

const cancelSchema = z.object({
  reference: z.string().min(1),
  token: z.string().min(1),
});

export type CancelBookingResult =
  | { ok: true; refunded: boolean; message: string }
  | { ok: false; error: string };

export async function cancelBookingWithToken(
  formData: FormData
): Promise<CancelBookingResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = cancelSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Brakujące dane anulacji.' };
  }
  const { reference, token } = parsed.data;

  const { secondaryKey } = await getRateLimitKeys({ token });
  const limit = await checkCancelRateLimit(secondaryKey);
  if (!limit.success) {
    return { ok: false, error: 'Zbyt wiele prób anulacji. Spróbuj później.' };
  }

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, workshop_session_id, total_price_gross_grosz')
    .eq('booking_reference', reference)
    .single();
  if (!booking) {
    return { ok: false, error: 'Nie znaleziono rezerwacji.' };
  }
  if (!isBookingActive(booking.status)) {
    return { ok: false, error: 'Rezerwacja nie może zostać anulowana.' };
  }

  const { data: session } = await supabase
    .from('workshop_sessions')
    .select('starts_at')
    .eq('id', booking.workshop_session_id)
    .single();
  const sessionStart = session?.starts_at ? new Date(session.starts_at) : null;
  const now = new Date();
  const hoursBefore = sessionStart
    ? (sessionStart.getTime() - now.getTime()) / (1000 * 60 * 60)
    : null;
  if (hoursBefore === null || hoursBefore < CANCELLATION_HOURS_BEFORE_SESSION) {
    return {
      ok: false,
      error:
        'Anulacja i automatyczny zwrot są możliwe do 24 godzin przed warsztatem. Po tym czasie skontaktuj się z nami.',
    };
  }

  const { data: verified } = await supabase.rpc('verify_cancellation_token', {
    p_booking_id: booking.id,
    p_token: token,
  });
  if (!verified) {
    return {
      ok: false,
      error: 'Link anulacyjny jest nieprawidłowy, wygasł lub został już użyty.',
    };
  }

  await supabase.rpc('cancel_booking', {
    p_booking_id: booking.id,
    p_cancelled_by: 'customer',
    p_reason: 'Customer cancellation via email link',
  });

  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, provider, status, amount_gross_grosz, provider_payment_id, refunded_amount_grosz'
    )
    .eq('booking_id', booking.id)
    .eq('status', 'paid')
    .single();

  let refunded = false;
  if (payment && payment.provider === 'stripe' && payment.provider_payment_id) {
    try {
      await createStripeRefund({
        paymentId: payment.id,
        paymentIntentId: payment.provider_payment_id,
        amountGrosz: payment.amount_gross_grosz,
        reason: 'Customer cancellation within refund window',
        idempotencyKey: `refund-${payment.id}`,
      });
      await supabase.rpc('record_payment_refund', {
        p_payment_id: payment.id,
        p_refund_amount_grosz: payment.amount_gross_grosz,
        p_reason: 'Customer cancellation within 24h refund window',
      });
      refunded = true;
    } catch (err) {
      console.error('Customer refund failed', err);
    }
  }

  const ctx = await getBookingEmailContext(booking.id);
  if (ctx) {
    await sendBookingCancellationEmail(ctx);
    if (refunded) {
      await sendRefundEmail(ctx, ctx.totalGrossGrosz);
    }
  }

  return {
    ok: true,
    refunded,
    message: refunded
      ? 'Rezerwacja została anulowana, a środki zostaną zwrócone.'
      : 'Rezerwacja została anulowana.',
  };
}
