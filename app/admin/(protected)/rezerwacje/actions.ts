'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import {
  manualBookingInputSchema,
  refundInputSchema,
} from '@/lib/database/schema';
import {
  canCancelBooking,
  canRefundPayment,
  canMoveBooking,
} from '@/lib/booking/state';
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendRefundEmail,
  getBookingEmailContext,
} from '@/lib/booking/email';
import { createStripeRefund } from '@/lib/booking/payment';
import type { Json } from '@/lib/database/types';

const adminListParamsSchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['created_at', 'confirmed_at', 'total_price_gross_grosz'])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type AdminListParams = z.infer<typeof adminListParamsSchema>;

export async function getBookingsAction(params: AdminListParams) {
  await requireAnyRole(['owner', 'manager']);
  const parsed = adminListParamsSchema.parse(params);
  const supabase = createAdminClient();

  // Disambiguate workshop_sessions: bookings also FK moved_from/to session.
  let query = supabase.from('bookings').select(
    `
      id,
      booking_reference,
      status,
      quantity,
      total_price_gross_grosz,
      source,
      created_at,
      expires_at,
      confirmed_at,
      customer_profiles (first_name, last_name, email),
      workshop_sessions!workshop_session_id (starts_at, workshops (title))
    `,
    { count: 'exact' }
  );

  if (parsed.status) query = query.eq('status', parsed.status);
  if (parsed.source) query = query.eq('source', parsed.source);
  if (parsed.sessionId)
    query = query.eq('workshop_session_id', parsed.sessionId);
  if (parsed.from) query = query.gte('created_at', parsed.from);
  if (parsed.to) query = query.lte('created_at', parsed.to);

  // Search only on bookings columns — nested or() across embeds is unsupported.
  if (parsed.search) {
    const term = parsed.search.trim();
    if (term) {
      query = query.ilike('booking_reference', `%${term}%`);
    }
  }

  query = query.order(parsed.sortBy, { ascending: parsed.sortOrder === 'asc' });
  query = query.range(
    (parsed.page - 1) * parsed.pageSize,
    parsed.page * parsed.pageSize - 1
  );

  const { data, error, count } = await query;
  if (error) {
    console.error('getBookingsAction failed', {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    throw new Error('Nie udało się pobrać rezerwacji.');
  }
  return { bookings: data ?? [], count: count ?? 0 };
}

export async function getBookingDetailAction(id: string) {
  await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      *,
      customer_profiles (first_name, last_name, email, phone, marketing_consent, marketing_consent_at, privacy_policy_version),
      workshop_sessions!workshop_session_id (id, starts_at, ends_at, timezone, capacity, reserved_count, location_name, location_address, workshops (id, title, slug)),
      booking_participants (id, display_name, age, participant_type, accessibility_notes),
      payments (id, provider, status, amount_gross_grosz, provider_checkout_id, provider_payment_id, paid_at, refunded_amount_grosz, refund_reason, failure_message)
    `
    )
    .eq('id', id)
    .single();
  if (error || !data) {
    throw new Error('Rezerwacja nie została znaleziona.');
  }
  return data;
}

export async function getBookingEventsAction(id: string) {
  await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('booking_events')
    .select('*')
    .eq('booking_id', id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Nie udało się pobrać historii.');
  return data ?? [];
}

export async function getBookingEmailsAction(id: string) {
  await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('booking_emails')
    .select(
      'id, email_type, status, provider_message_id, error_message, sent_at, created_at'
    )
    .eq('booking_id', id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Nie udało się pobrać historii e-maili.');
  return data ?? [];
}

export async function createManualBookingAction(
  input: z.infer<typeof manualBookingInputSchema>
) {
  const admin = await requireAnyRole(['owner', 'manager']);
  const parsed = manualBookingInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const supabase = createAdminClient();
  const participants = data.participants.map((p) => ({
    display_name: p.displayName,
    age: p.age ?? null,
    participant_type: p.participantType,
    accessibility_notes: p.accessibilityNotes ?? null,
  }));

  const status = data.paymentStatus;
  const paymentStatus = status === 'confirmed' ? 'paid' : 'pending';
  const paymentProvider = data.paymentMethod;

  const { data: result, error } = await supabase.rpc('begin_booking', {
    p_session_id: data.sessionId,
    p_quantity: data.quantity,
    p_customer_email: data.purchaserEmail,
    p_customer_first_name: data.purchaserFirstName,
    p_customer_last_name: data.purchaserLastName,
    p_customer_phone: data.purchaserPhone,
    p_customer_notes: data.customerNotes ?? '',
    p_marketing_consent: data.marketingConsent,
    p_terms_accepted_at: new Date().toISOString(),
    p_privacy_policy_version: data.privacyPolicyVersion ?? 'admin',
    p_participants: participants as unknown as Json,
    p_source: 'admin',
    p_payment_provider: paymentProvider,
    p_payment_status: paymentStatus,
    p_admin_user_id: admin.userId,
    p_internal_notes: data.internalNotes ?? '',
    p_status: status,
  });

  if (error || !result) {
    console.error('Manual booking failed', error);
    return { ok: false, error: 'Nie udało się utworzyć rezerwacji.' };
  }

  const reservation = result as unknown as {
    booking_id: string;
    payment_id: string;
    booking_reference: string;
  };

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'booking.created',
    entityType: 'booking',
    entityId: reservation.booking_id,
    summary: `Manual booking ${reservation.booking_reference} created`,
    changedFields: {
      reference: reservation.booking_reference,
      source: 'admin',
    } as Record<string, unknown>,
  });

  if (status === 'confirmed') {
    const ctx = await getBookingEmailContext(reservation.booking_id);
    if (ctx) {
      await sendBookingConfirmationEmail(ctx);
    }
  }

  revalidatePath('/admin/rezerwacje');
  return {
    ok: true,
    bookingId: reservation.booking_id,
    reference: reservation.booking_reference,
  };
}

export async function confirmManualPaymentAction(bookingId: string) {
  const admin = await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, status, amount_gross_grosz')
    .eq('booking_id', bookingId)
    .single();
  if (!payment || payment.status !== 'pending') {
    throw new Error('Brak oczekującej płatności do potwierdzenia.');
  }

  await supabase
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payment.id);
  await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      expires_at: null,
    })
    .eq('id', bookingId);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'booking.payment_confirmed',
    entityType: 'booking',
    entityId: bookingId,
    summary: 'Manual payment confirmed',
    changedFields: { payment_status: 'paid' } as Record<string, unknown>,
  });

  const ctx = await getBookingEmailContext(bookingId);
  if (ctx) {
    await sendBookingConfirmationEmail(ctx);
  }

  revalidatePath('/admin/rezerwacje');
  revalidatePath('/admin/rezerwacje/' + bookingId);
  return { ok: true };
}

export async function cancelBookingAction(bookingId: string, reason: string) {
  const admin = await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();
  if (!booking || !canCancelBooking(booking.status)) {
    throw new Error('Rezerwacja nie może zostać anulowana w tym stanie.');
  }

  await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_cancelled_by: 'staff',
    p_reason: reason,
    p_actor_id: admin.userId,
    p_actor_role: admin.role,
  });

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'booking.cancelled',
    entityType: 'booking',
    entityId: bookingId,
    summary: `Booking cancelled: ${reason}`,
    changedFields: { reason } as Record<string, unknown>,
  });

  revalidatePath('/admin/rezerwacje');
  revalidatePath('/admin/rezerwacje/' + bookingId);
  return { ok: true };
}

export async function refundBookingAction(
  bookingId: string,
  input: z.infer<typeof refundInputSchema>
) {
  const admin = await requireAnyRole(['owner', 'manager']);
  const parsed = refundInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const refund = parsed.data;

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select(
      'id, provider, status, provider_payment_id, amount_gross_grosz, refunded_amount_grosz'
    )
    .eq('booking_id', bookingId)
    .single();
  if (!payment || !canRefundPayment(payment.status)) {
    throw new Error('Brak płatności do zwrotu.');
  }

  if (
    refund.amountGrossGrosz >
    payment.amount_gross_grosz - payment.refunded_amount_grosz
  ) {
    throw new Error('Kwota zwrotu przekracza dostępny saldo.');
  }

  if (payment.provider === 'stripe' && payment.provider_payment_id) {
    try {
      await createStripeRefund({
        paymentId: payment.id,
        paymentIntentId: payment.provider_payment_id,
        amountGrosz: refund.amountGrossGrosz,
        reason: refund.reason,
        idempotencyKey: `refund-${payment.id}-${refund.amountGrossGrosz}`,
      });
    } catch (err) {
      console.error('Stripe refund failed', err);
      throw new Error(
        'Zwrot przez Stripe nie powiódł się. Spróbuj ponownie lub rozwiąż ręcznie.'
      );
    }
  }

  await supabase.rpc('record_payment_refund', {
    p_payment_id: payment.id,
    p_refund_amount_grosz: refund.amountGrossGrosz,
    p_reason: refund.reason,
  });

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'booking.refunded',
    entityType: 'booking',
    entityId: bookingId,
    summary: `Refund ${refund.amountGrossGrosz} grosz issued`,
    changedFields: {
      refund_amount_grosz: refund.amountGrossGrosz,
      reason: refund.reason,
    } as Record<string, unknown>,
  });

  const ctx = await getBookingEmailContext(bookingId);
  if (ctx) {
    await sendRefundEmail(ctx, refund.amountGrossGrosz);
  }

  revalidatePath('/admin/rezerwacje');
  revalidatePath('/admin/rezerwacje/' + bookingId);
  return { ok: true };
}

export async function moveBookingAction(
  bookingId: string,
  destinationSessionId: string
) {
  const admin = await requireAnyRole(['owner', 'manager']);
  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .single();
  if (!booking || !canMoveBooking(booking.status)) {
    throw new Error('Rezerwacja nie może zostać przeniesiona.');
  }

  const { error } = await supabase.rpc('move_booking', {
    p_booking_id: bookingId,
    p_destination_session_id: destinationSessionId,
    p_actor_id: admin.userId,
    p_actor_role: admin.role,
  });
  if (error) {
    console.error('move_booking failed', error);
    throw new Error('Nie udało się przenieść rezerwacji.');
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'booking.moved',
    entityType: 'booking',
    entityId: bookingId,
    summary: `Booking moved to session ${destinationSessionId}`,
    changedFields: { destination_session_id: destinationSessionId } as Record<
      string,
      unknown
    >,
  });

  revalidatePath('/admin/rezerwacje');
  revalidatePath('/admin/rezerwacje/' + bookingId);
  return { ok: true };
}

export async function retryEmailAction(
  bookingId: string,
  emailType: 'confirmation' | 'cancellation' | 'refund' | 'manual_confirmation'
) {
  await requireAnyRole(['owner', 'manager']);
  const ctx = await getBookingEmailContext(bookingId);
  if (!ctx) {
    throw new Error('Nie znaleziono rezerwacji.');
  }
  switch (emailType) {
    case 'confirmation':
    case 'manual_confirmation':
      await sendBookingConfirmationEmail(ctx);
      break;
    case 'cancellation':
      await sendBookingCancellationEmail(ctx);
      break;
    case 'refund':
      await sendRefundEmail(ctx, ctx.totalGrossGrosz);
      break;
  }
  revalidatePath('/admin/rezerwacje/' + bookingId);
  return { ok: true };
}
