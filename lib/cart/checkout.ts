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

const participantSchema = z.object({
  display_name: z.string().max(120).optional().nullable(),
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
  purchaserPhone: z.string().max(40).optional().default(''),
  customerNotes: z.string().max(1000).optional().default(''),
  marketingConsent: z.boolean(),
  termsAccepted: z.literal(true),
  privacyPolicyVersion: z.string().min(1),
  participantsBySession: z.record(z.array(participantSchema)),
  shipping: shippingSchema.optional().nullable(),
  lines: z.array(z.any()).min(1).max(20),
  /** Explicit when PAYMENTS_PROVIDER=both; ignored for manual/stripe-only modes. */
  paymentMethod: z.enum(['stripe', 'bank_transfer']).optional().nullable(),
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
      paymentMethod: 'stripe' | 'bank_transfer';
      checkoutUrl?: string;
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
  if (msg.includes('insufficient capacity')) {
    return 'Brak wolnych miejsc. Odśwież koszyk i spróbuj ponownie.';
  }
  if (msg.includes('inventory')) {
    return 'Niewystarczający stan magazynowy. Odśwież koszyk.';
  }
  if (msg.includes('session is not open') || msg.includes('booking')) {
    return 'Termin nie jest już dostępny do rezerwacji. Odśwież koszyk.';
  }
  return 'Nie udało się złożyć zamówienia. Dostępność mogła się zmienić — odśwież koszyk.';
}

function orderIdempotencyKey(input: {
  email: string;
  lines: CartLine[];
  firstName: string;
  lastName: string;
}): string {
  const fingerprint = input.lines
    .map((l) =>
      l.type === 'workshop_session'
        ? `w:${l.sessionId}:${l.quantity}`
        : `p:${l.productId}:${l.fulfillment}:${l.quantity}`
    )
    .sort()
    .join('|');
  return createHash('sha256')
    .update(
      [
        input.email.trim().toLowerCase(),
        input.firstName.trim().toLowerCase(),
        input.lastName.trim().toLowerCase(),
        fingerprint,
      ].join('|')
    )
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

  const needsShipping = revalidated.lines.some(
    (l) =>
      (l.type === 'physical_product' || l.type === 'studio_service') &&
      l.fulfillment === 'shipping' &&
      l.requiresShipping
  );
  if (needsShipping && !data.shipping) {
    return {
      ok: false,
      error: 'Podaj adres dostawy dla produktów wysyłkowych.',
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
    if (line.ageRequired) {
      for (const [index, part] of parts.entries()) {
        const age = normalizeParticipantAge(part.age);
        if (age == null) {
          return {
            ok: false,
            error: `Podaj wiek uczestnika ${index + 1} dla warsztatu „${line.workshopTitle}”.`,
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
            error: `Wiek uczestnika ${index + 1} jest poza limitem warsztatu (${range}).`,
          };
        }
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
    (l) =>
      (l.type === 'physical_product' || l.type === 'studio_service') &&
      l.fulfillment === 'shipping' &&
      l.requiresShipping
  );

  const { resolveCheckoutPaymentMethod, shouldCreateStripeCheckoutNow } =
    await import('@/lib/payments/provider');
  const paymentResolved = resolveCheckoutPaymentMethod({
    requested: data.paymentMethod,
    shippingQuoteRequired: shippingQuoteRequiredPreview,
  });
  if (!paymentResolved.ok) {
    return { ok: false, error: paymentResolved.error };
  }

  if (paymentResolved.method === 'bank_transfer') {
    const { loadBankTransferConfig } =
      await import('@/lib/payments/bank-transfer');
    // Known-total manual orders require complete bank details up front.
    if (!shippingQuoteRequiredPreview) {
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
  }

  const rpcLines = revalidated.lines.map((line) => {
    if (line.type === 'workshop_session') {
      return {
        type: 'workshop_session',
        session_id: line.sessionId,
        quantity: line.quantity,
        participants: (data.participantsBySession[line.sessionId] ?? []).map(
          (p) => ({
            display_name: p.display_name ?? '',
            age: normalizeParticipantAge(p.age),
            participant_type: p.participant_type,
            accessibility_notes: p.accessibility_notes ?? null,
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

  const idempotencyKey = orderIdempotencyKey({
    email: data.purchaserEmail,
    lines: revalidated.lines,
    firstName: data.purchaserFirstName,
    lastName: data.purchaserLastName,
  });

  const supabase = createCartAdminClient();
  const { data: result, error } = await supabase.rpc('submit_cart_order', {
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
  });

  if (error || !result) {
    console.error('submit_cart_order failed', {
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
  };

  // Persist explicit payment method (migration 15). Tolerate missing column.
  {
    const methodPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    methodPatch.selected_payment_method = paymentResolved.method;
    const { error: methodError } = await supabase
      .from('orders')
      .update(methodPatch)
      .eq('id', payload.order_id);
    if (methodError?.message?.includes('selected_payment_method')) {
      console.warn(
        'selected_payment_method column missing — apply migration 15'
      );
    }

    if (payload.payment_id) {
      await supabase
        .from('payments')
        .update({
          provider:
            paymentResolved.method === 'stripe' ? 'stripe' : 'bank_transfer',
          status: paymentResolved.method === 'stripe' ? 'created' : 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.payment_id);
    }

    if (payload.public_lookup_token) {
      await supabase.from('order_events').insert({
        order_id: payload.order_id,
        event_type: 'portal_token_issued',
        actor_type: 'system',
        metadata: {
          // Opaque portal token — equivalent security to the URL itself.
          public_lookup_token: payload.public_lookup_token,
        },
      });
    }
  }

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
        // Order already reserved — send customer to status page to retry pay.
        console.error(
          'stripe checkout after cart submit failed; order kept for retry',
          session.error
        );
      }
    } catch (err) {
      console.error(
        'stripe checkout after cart submit threw; order kept for retry',
        err
      );
    }
  }

  // Ensure admin notification ledger row exists (recipient from env).
  if (!payload.reused) {
    const adminEmail = process.env.BOOKING_ADMIN_EMAIL?.trim();
    if (adminEmail) {
      await supabase.from('order_emails').insert({
        order_id: payload.order_id,
        email_type: 'admin_notification',
        recipient: adminEmail,
        status: 'pending',
      });
    }
    try {
      const { notifyOrderCreated } = await import('@/lib/cart/order-email');
      await notifyOrderCreated(payload.order_id, {
        publicLookupToken: payload.public_lookup_token,
      });
    } catch (err) {
      console.error('order email notify failed', err);
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
    paymentMethod: paymentResolved.method,
    checkoutUrl,
  };
}
