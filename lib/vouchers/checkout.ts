'use server';

import 'server-only';
import { z } from 'zod';
import type { CartLine } from '@/lib/cart/types';
import { revalidateCartLines } from '@/lib/cart/revalidate';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import {
  checkBookingRateLimit,
  getRateLimitKeys,
} from '@/lib/booking/rate-limit';
import { ensureExternalVoucherLoaded } from '@/lib/vouchers/providers';
import { mapVoucherError, normalizeVoucherCode } from '@/lib/vouchers/helpers';

const voucherInputSchema = z.object({
  code: z.string().trim().min(4).max(120),
  providerCode: z.string().trim().max(80).optional().nullable(),
  purchaserEmail: z.string().email().optional().nullable(),
  lines: z.array(z.any()).min(1).max(20),
});

export type VoucherCheckoutPreview = {
  providerCode: string;
  providerName: string;
  voucherType: 'fixed_amount' | 'workshop_specific' | 'experience';
  description: string | null;
  maskedCode: string;
  remainingValueGrosz: number;
  applicableGrosz: number;
  amountDueGrosz: number;
  currency: 'PLN';
  validUntil: string | null;
  allowedWorkshopTypes: string[];
};

export type ValidateVoucherResult =
  | { ok: true; voucher: VoucherCheckoutPreview }
  | { ok: false; error: string };

export async function validateVoucherForCheckout(
  input: z.infer<typeof voucherInputSchema>
): Promise<ValidateVoucherResult> {
  const parsed = voucherInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Wpisz poprawny kod bonu.' };
  }

  const data = parsed.data;
  const revalidated = await revalidateCartLines(data.lines as CartLine[]);
  if (!revalidated.canCheckout) {
    return {
      ok: false,
      error: 'Koszyk zawiera niedostępne pozycje. Odśwież go przed użyciem bonu.',
    };
  }
  if (revalidated.lines.some((line) => line.type !== 'workshop_session')) {
    return {
      ok: false,
      error: 'Bon można wykorzystać wyłącznie na rezerwację warsztatów.',
    };
  }

  const normalizedCode = normalizeVoucherCode(data.code);
  const { ipKey, secondaryKey } = await getRateLimitKeys({
    sessionId: 'voucher-validation',
    email: data.purchaserEmail ?? 'voucher-validation@ceramikanero.local',
  });
  const rateLimit = await checkBookingRateLimit(ipKey, secondaryKey);
  if (!rateLimit.success) {
    return {
      ok: false,
      error: 'Zbyt wiele prób sprawdzenia bonu. Spróbuj ponownie za chwilę.',
    };
  }

  try {
    await ensureExternalVoucherLoaded({
      providerCode: data.providerCode,
      code: normalizedCode,
    });

    const rpcLines = revalidated.lines.map((line) => {
      if (line.type !== 'workshop_session') {
        throw new Error('Voucher cart must contain workshops only');
      }
      return {
        type: 'workshop_session',
        session_id: line.sessionId,
        quantity: line.quantity,
      };
    });
    const supabase = createCartAdminClient() as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: result, error } = await supabase.rpc(
      'validate_checkout_voucher',
      {
        p_code: normalizedCode,
        p_lines: rpcLines,
        p_subtotal_grosz: revalidated.subtotalGrosz,
      }
    );
    if (error || !result) {
      return { ok: false, error: mapVoucherError(error?.message) };
    }

    const value = result as {
      provider_code: string;
      provider_name: string;
      voucher_type: VoucherCheckoutPreview['voucherType'];
      description?: string | null;
      masked_code: string;
      remaining_value_grosz: number;
      applicable_grosz: number;
      amount_due_grosz: number;
      currency: 'PLN';
      valid_until?: string | null;
      allowed_workshop_types?: string[];
    };

    return {
      ok: true,
      voucher: {
        providerCode: value.provider_code,
        providerName: value.provider_name,
        voucherType: value.voucher_type,
        description: value.description ?? null,
        maskedCode: value.masked_code,
        remainingValueGrosz: Number(value.remaining_value_grosz),
        applicableGrosz: Number(value.applicable_grosz),
        amountDueGrosz: Number(value.amount_due_grosz),
        currency: value.currency,
        validUntil: value.valid_until ?? null,
        allowedWorkshopTypes: value.allowed_workshop_types ?? [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: mapVoucherError(error instanceof Error ? error.message : undefined),
    };
  }
}
