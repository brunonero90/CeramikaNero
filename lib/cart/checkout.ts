'use server';

import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import type { CartLine } from '@/lib/cart/types';
import { revalidateCartLines } from '@/lib/cart/revalidate';
import {
  getRateLimitKeys,
  checkBookingRateLimit,
} from '@/lib/booking/rate-limit';
import type { Json } from '@/lib/database/types';
import { ensureExternalVoucherLoaded } from '@/lib/vouchers/providers';
import { normalizeVoucherCode } from '@/lib/vouchers/helpers';

const participantSchema = z.object({
  display_name: z.string().trim().min(1, 'Podaj imię uczestnika').max(120),
  age: z.union([z.number().int(), z.string()]).optional().nullable(),
  participant_type: z
    .enum(['adult', 'child', 'unspecified'])
    .default('unspecified'),
  accessibility_notes: z.string().max(500).optional().nullable(),
});

const shippingSchema = z.object({
  recipient_name: z.string().min(2).max(120),
  street_line1: z.string().min(2).max(200),
  street_line2: z.string().max(200).optional().nullable(),
  postal_code: z.string().min(5).max(12),
  city: z.string().min(2).max(100),
  country: z.literal('PL').default('PL'),
  phone: z.string().max(40).optional().nullable(),
});

const checkoutSchema = z.object({
  purchaserFirstName: z.string().min(1).max(80),
  purchaserLastName: z.string().min(1).max(80),
  purchaserEmail: z.string().email().max(200),
  purchaserPhone: z.string().trim().min(5, 'Podaj numer telefonu').max(40),
  customerNotes: z.string().max(1000).optional().default(''),
  marketingConsent: z.boolean(),
  termsAccepted: z.literal(true),
  privacyPolicyVersion: z.string().min(1),
  participantsBySession: z.record(z.array(participantSchema)),
  shipping: shippingSchema.optional().nullable(),
  lines: z.array(z.any()).min(1).max(20),
  submissionKey: z.string().uuid(),
  paymentMethod: z.enum(['stripe', 'bank_transfer']).optional().nullable(),
  voucherCode: z.string().trim().min(4).max(120).optional().nullable(),
  voucherProviderCode: z.string().trim().max(80).optional().nullable(),
});

export type SubmitCartResult =
  | {
      ok: true;
      orderReference: string;
      bookingReferences: string[];
      totalGrossGrosz: number;
      shippingQuoteRequired: boolean;
      publicLookupToken?: string;
      reused?: boolean;
      paymentMethod: 'stripe' | 'bank_transfer' | 'voucher';
      checkoutUrl?: string;
      voucherAppliedGrosz?: number;
      voucherMaskedCode?: string;
      voucherProviderName?: string;
      voucherRemainingGrosz?: number;
      voucherFullyPaid?: boolean;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function normalizeParticipantAge(
  age: number | string | null | undefined
): number | null {
  if (age == null || age === '') return null;
  const n = typeof age === 'number' ? age : Number.parseInt(String(age), 10);
  if (!Number.isFinite(n) || n < 0 || n > 120) return null;
  return n;
}

function mapSubmitCartOrderError(message: string | undefined): string {
  const msg = (message ?? '').toLowerCase();
  if (msg.includes('participant age is required')) {
    return 'Podaj wiek każdego uczestnika — ten warsztat ma limit wieku.';
  }
  if (msg.includes('participant age is outside')) {
    return 'Wiek uczestnika jest poza limitem warsztatu.';
  }
  if (msg.includes('follow-up') || msg.includes('linked bookings')) {
    return 'Wybrany termin drugiego etapu nie jest już dostępny. Wybierz inny termin i spróbuj ponownie.';
  }
  if (msg.includes('insufficient capacity')) {
    return 'Brak wolnych miejsc. Odśwież koszyk i spróbuj ponownie.';
  }
  if (msg.includes('inventory')) {
    return 'Niewystarczający stan magazynowy. Odśwież koszyk.';
  }
  if (
    msg.includes('voucher not found') ||
    msg.includes('voucher code is invalid')
  ) {
    return 'Nie znaleziono bonu o takim kodzie.';
  }
  if (msg.includes('voucher is expired')) return 'Ten bon stracił ważność.';
  if (msg.includes('voucher is cancelled')) return 'Ten bon został anulowany.';
  if (msg.includes('already been redeemed')) {
    return 'Ten bon został już wykorzystany.';
  }
  if (
    msg.includes('voucher is not valid') ||
    msg.includes('voucher can only be used')
  ) {
    return 'Ten bon nie obejmuje wybranego warsztatu.';
  }
  if (msg.includes('different voucher') || msg.includes('voucher order')) {
    return 'Dane koszyka lub bonu zmieniły się. Odśwież stronę i spróbuj ponownie.';
  }
  if (msg.includes('session is not open') || msg.includes('booking')) {
    return 'Termin nie jest już dostępny do rezerwacji. Odśwież koszyk.';
  }
  return 'Nie udało się złożyć zamówienia. Dostępność mogła się zmienić — odśwież koszyk.';
}

function orderIdempotencyKey(submissionKey: string): string {
  return createHash('sha256')
    .update(`cart-submit:${submissionKey}`)
    .digest('hex');
}

export async function submitCartOrder(
  input: z.infer<typeof checkoutSchema>
): Promise<SubmitCartResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Sprawdź poprawność formularza.',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const data = parsed.data;
  const lines = data.lines as CartLine[];
  const revalidated = await revalidateCartLines(lines);
  if (!revalidated.canCheckout) {
    return {
      ok: false,
      error:
        'Koszyk zawiera niedostępne pozycje. Popraw koszyk i spróbuj ponownie.',
    };
  }

  const workshopLines = revalidated.lines.filter(
    (line) => line.type === 'workshop_session'
  );
  for (const primary of workshopLines) {
    if (
      primary.type !== 'workshop_session' ||
      !primary.requiresFollowupSession
    ) {
      continue;
    }
    const followup = workshopLines.find(
      (candidate) =>
        candidate.type === 'workshop_session' &&
        candidate.linkRole === 'followup' &&
        candidate.linkedPrimarySessionId === primary.sessionId
    );
    if (!followup || followup.type !== 'workshop_session') {
      return {
        ok: false,
        error: 'Wybierz obowiązkowy termin drugiego etapu warsztatu.',
      };
    }
    if (followup.quantity !== primary.quantity) {
      return {
        ok: false,
        error: 'Liczba miejsc musi być taka sama w obu etapach warsztatu.',
      };
    }
    if (
      !(primary.followupOptions ?? []).some(
        (option) => option.sessionId === followup.sessionId
      )
    ) {
      return {
        ok: false,
        error:
          'Wybrany termin drugiego etapu nie jest już dostępny. Odśwież stronę.',
      };
    }
  }

  const needsShipping = revalidated.lines.some(
    (line) =>
      (line.type === 'physical_product' || line.type === 'studio_service') &&
      line.fulfillment === 'shipping' &&
      line.requiresShipping
  );
  if (needsShipping && !data.shipping) {
    return {
      ok: false,
      error: 'Podaj adres dostawy dla produktów wysyłkowych.',
    };
  }
  if (
    data.voucherCode &&
    revalidated.lines.some((line) => line.type !== 'workshop_session')
  ) {
    return {
      ok: false,
      error: 'Bon można wykorzystać wyłącznie na rezerwację warsztatów.',
    };
  }

  for (const line of revalidated.lines) {
    if (line.type !== 'workshop_session') continue;
    const parts = data.participantsBySession[line.sessionId];
    if (!parts || parts.length !== line.quantity) {
      return {
        ok: false,
        error: 'Uzupełnij dane uczestników dla każdego warsztatu.',
      };
    }
    const audience = line.participantAudience ?? 'adult';
    for (const [index, part] of parts.entries()) {
      const participantType =
        audience === 'adult'
          ? 'adult'
          : audience === 'child'
            ? 'child'
            : part.participant_type;
      if (audience === 'mixed' && participantType === 'unspecified') {
        return {
          ok: false,
          error: `Wybierz, czy uczestnik ${index + 1} jest dorosły czy jest dzieckiem.`,
        };
      }
      if (participantType !== 'child' || !line.collectParticipantAge) {
        continue;
      }
      const age = normalizeParticipantAge(part.age);
      if (age == null) {
        return {
          ok: false,
          error: `Podaj wiek dziecka ${index + 1} dla warsztatu „${line.workshopTitle}”.`,
        };
      }
      if (
        (line.minimumAge != null && age < line.minimumAge) ||
        (line.maximumAge != null && age > line.maximumAge)
      ) {
        const range =
          line.minimumAge != null && line.maximumAge != null
            ? `${line.minimumAge}–${line.maximumAge}`
            : line.minimumAge != null
              ? `${line.minimumAge}+`
              : `do ${line.maximumAge}`;
        return {
          ok: false,
          error: `Wiek dziecka ${index + 1} jest poza limitem warsztatu (${range}).`,
        };
      }
    }
  }

  const { ipKey, secondaryKey } = await getRateLimitKeys({
    sessionId: 'cart',
    email: data.purchaserEmail,
  });
  const limit = await checkBookingRateLimit(ipKey, secondaryKey);
  if (!limit.success) {
    return {
      ok: false,
      error: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
    };
  }

  const shippingQuoteRequiredPreview = revalidated.lines.some(
    (line) =>
      (line.type === 'physical_product' || line.type === 'studio_service') &&
      line.fulfillment === 'shipping' &&
      line.requiresShipping
  );

  let voucherAmountDuePreview: number | null = null;
  if (data.voucherCode) {
    try {
      await ensureExternalVoucherLoaded({
        providerCode: data.voucherProviderCode,
        code: normalizeVoucherCode(data.voucherCode),
      });
    } catch (providerError) {
      console.error('voucher provider validation failed', providerError);
      return {
        ok: false,
        error:
          'Nie udało się teraz sprawdzić bonu u partnera. Bon nie został wykorzystany — spróbuj ponownie później.',
      };
    }
    const voucherSupabase = createCartAdminClient() as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const voucherLines = revalidated.lines.map((line) => {
      if (line.type !== 'workshop_session') {
        throw new Error('Voucher cart must contain workshops only');
      }
      return {
        type: 'workshop_session',
        session_id: line.sessionId,
        quantity: line.quantity,
      };
    });
    const { data: voucherPreview, error: voucherPreviewError } =
      await voucherSupabase.rpc('validate_checkout_voucher', {
        p_code: normalizeVoucherCode(data.voucherCode),
        p_lines: voucherLines,
        p_subtotal_grosz: revalidated.subtotalGrosz,
      });
    if (voucherPreviewError || !voucherPreview) {
      return {
        ok: false,
        error: mapSubmitCartOrderError(voucherPreviewError?.message),
      };
    }
    voucherAmountDuePreview = Number(
      (voucherPreview as { amount_due_grosz?: number }).amount_due_grosz ?? 0
    );
  }

  const { resolveCheckoutPaymentMethod, shouldCreateStripeCheckoutNow } =
    await import('@/lib/payments/provider');
  const paymentResolved =
    voucherAmountDuePreview === 0
      ? ({
          ok: true as const,
          method: data.paymentMethod ?? ('bank_transfer' as const),
        } as const)
      : resolveCheckoutPaymentMethod({
          requested: data.paymentMethod,
          shippingQuoteRequired: shippingQuoteRequiredPreview,
        });
  if (!paymentResolved.ok) {
    return { ok: false, error: paymentResolved.error };
  }

  if (
    paymentResolved.method === 'bank_transfer' &&
    !shippingQuoteRequiredPreview &&
    (voucherAmountDuePreview == null || voucherAmountDuePreview > 0)
  ) {
    const { loadBankTransferConfig } =
      await import('@/lib/payments/bank-transfer');
    const bank = await loadBankTransferConfig();
    if (!bank.ok) {
      console.error('checkout blocked: incomplete bank transfer config', {
        error: bank.error,
      });
      return {
        ok: false,
        error:
          'Płatność przelewem jest tymczasowo niedostępna. Skontaktuj się z pracownią.',
      };
    }
  }

  const rpcLines = revalidated.lines.map((line) => {
    if (line.type === 'workshop_session') {
      return {
        type: 'workshop_session',
        session_id: line.sessionId,
        quantity: line.quantity,
        link_role: line.linkRole ?? null,
        linked_primary_session_id: line.linkedPrimarySessionId ?? null,
        link_group_key: line.linkGroupKey ?? null,
        participants: (data.participantsBySession[line.sessionId] ?? []).map(
          (participant) => ({
            display_name: participant.display_name ?? '',
            age: normalizeParticipantAge(participant.age),
            participant_type: participant.participant_type,
            accessibility_notes: participant.accessibility_notes ?? null,
          })
        ),
      };
    }
    return {
      type: line.type,
      product_id: line.productId,
      quantity: line.quantity,
      fulfillment: line.fulfillment,
    };
  });

  const idempotencyKey = orderIdempotencyKey(data.submissionKey);
  const supabase = createCartAdminClient();
  const { data: result, error } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{
        data: unknown;
        error: { message: string; code?: string } | null;
      }>;
    }
  ).rpc('submit_cart_order_v4', {
    p_idempotency_key: idempotencyKey,
    p_customer_email: data.purchaserEmail,
    p_customer_first_name: data.purchaserFirstName,
    p_customer_last_name: data.purchaserLastName,
    p_customer_phone: data.purchaserPhone ?? '',
    p_customer_notes: data.customerNotes ?? '',
    p_marketing_consent: data.marketingConsent,
    p_terms_accepted_at: new Date().toISOString(),
    p_privacy_policy_version: data.privacyPolicyVersion,
    p_lines: rpcLines as unknown as Json,
    p_shipping_address: needsShipping
      ? (data.shipping as unknown as Json)
      : null,
    p_source: 'website',
    p_selected_payment_method: paymentResolved.method,
    p_voucher_code: data.voucherCode
      ? normalizeVoucherCode(data.voucherCode)
      : null,
  });

  if (error || !result) {
    console.error('submit_cart_order_v4 failed', {
      message: error?.message,
      code: error?.code,
    });
    return {
      ok: false,
      error: mapSubmitCartOrderError(error?.message),
    };
  }

  const payload = result as {
    order_id: string;
    order_reference: string;
    payment_id?: string;
    booking_references: string[];
    total_gross_grosz: number;
    shipping_quote_required: boolean;
    public_lookup_token?: string;
    reused?: boolean;
    voucher_applied_grosz?: number;
    voucher_masked_code?: string;
    voucher_provider_name?: string;
    voucher_remaining_grosz?: number;
    voucher_fully_paid?: boolean;
  };

  let checkoutUrl: string | undefined;
  if (
    !payload.reused &&
    shouldCreateStripeCheckoutNow({
      method: paymentResolved.method,
      shippingQuoteRequired: payload.shipping_quote_required,
      totalGrossGrosz: payload.total_gross_grosz,
    })
  ) {
    try {
      const { createOrReuseOrderCheckoutSession } =
        await import('@/lib/cart/order-checkout');
      const session = await createOrReuseOrderCheckoutSession({
        orderId: payload.order_id,
        publicLookupToken: payload.public_lookup_token,
      });
      if (session.ok) {
        checkoutUrl = session.checkoutUrl;
      } else {
        console.error(
          'stripe checkout after cart submit failed; order kept for retry',
          session.error
        );
      }
    } catch (stripeError) {
      console.error(
        'stripe checkout after cart submit threw; order kept for retry',
        stripeError
      );
    }
  }

  if (!payload.reused) {
    const adminEmail = process.env.BOOKING_ADMIN_EMAIL?.trim();
    if (adminEmail && !payload.voucher_fully_paid) {
      await supabase.from('order_emails').insert({
        order_id: payload.order_id,
        email_type: 'admin_notification',
        recipient: adminEmail,
        status: 'pending',
      });
    }
    try {
      if (payload.voucher_fully_paid) {
        const { notifyOrderPaymentReceived } =
          await import('@/lib/cart/order-email');
        await notifyOrderPaymentReceived(payload.order_id);
      } else {
        const { notifyOrderCreated } = await import('@/lib/cart/order-email');
        await notifyOrderCreated(payload.order_id, {
          publicLookupToken: payload.public_lookup_token,
        });
      }
    } catch (emailError) {
      console.error('order email notify failed', emailError);
    }
  }

  return {
    ok: true,
    orderReference: payload.order_reference,
    bookingReferences: payload.booking_references ?? [],
    totalGrossGrosz: payload.total_gross_grosz,
    shippingQuoteRequired: payload.shipping_quote_required,
    publicLookupToken: payload.public_lookup_token,
    reused: payload.reused,
    paymentMethod: payload.voucher_fully_paid
      ? 'voucher'
      : paymentResolved.method,
    checkoutUrl,
    voucherAppliedGrosz: payload.voucher_applied_grosz,
    voucherMaskedCode: payload.voucher_masked_code,
    voucherProviderName: payload.voucher_provider_name,
    voucherRemainingGrosz: payload.voucher_remaining_grosz,
    voucherFullyPaid: payload.voucher_fully_paid,
  };
}
