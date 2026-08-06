'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAnyRole } from '@/lib/admin/auth';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { parsePlnToGrosz } from '@/lib/payments/admin-money';

export type VoucherIssueState = {
  ok: boolean;
  message?: string;
  issuedCode?: string;
};

const initialState: VoucherIssueState = { ok: false };
export { initialState as initialVoucherIssueState };

const issueSchema = z.object({
  providerCode: z.enum(['ceramika_nero', 'prezent_marzen']),
  code: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  voucherType: z.enum(['fixed_amount', 'workshop_specific', 'experience']),
  valueGrosz: z.number().int().positive(),
  validFrom: z.string().datetime().nullable(),
  validUntil: z.string().datetime().nullable(),
  multiUse: z.boolean(),
  allowedWorkshopTypes: z.array(z.string().min(1).max(120)),
  allowedWorkshopIds: z.array(z.string().uuid()),
  refundPolicy: z.enum(['restore', 'replacement']),
});

function parseDate(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function splitValues(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function issueVoucherAction(
  _previous: VoucherIssueState,
  formData: FormData
): Promise<VoucherIssueState> {
  await requireAnyRole(['owner', 'manager']);

  const valueGrosz = parsePlnToGrosz(String(formData.get('valuePln') ?? ''));
  const parsed = issueSchema.safeParse({
    providerCode: String(formData.get('providerCode') ?? ''),
    code: String(formData.get('code') ?? '').trim() || undefined,
    description: String(formData.get('description') ?? '').trim() || undefined,
    voucherType: String(formData.get('voucherType') ?? ''),
    valueGrosz,
    validFrom: parseDate(formData.get('validFrom')),
    validUntil: parseDate(formData.get('validUntil')),
    multiUse: formData.get('multiUse') === 'on',
    allowedWorkshopTypes: splitValues(formData.get('allowedWorkshopTypes')),
    allowedWorkshopIds: splitValues(formData.get('allowedWorkshopIds')),
    refundPolicy: String(formData.get('refundPolicy') ?? 'restore'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        'Sprawdź wartość, daty i ograniczenia bonu. Identyfikatory warsztatów muszą być UUID.',
    };
  }
  if (parsed.data.providerCode !== 'ceramika_nero' && !parsed.data.code) {
    return { ok: false, message: 'Kod bonu partnera jest wymagany.' };
  }
  if (
    parsed.data.validFrom &&
    parsed.data.validUntil &&
    parsed.data.validUntil <= parsed.data.validFrom
  ) {
    return { ok: false, message: 'Data ważności musi być późniejsza.' };
  }

  const supabase = createCartAdminClient() as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await supabase.rpc('admin_issue_voucher', {
    p_provider_code: parsed.data.providerCode,
    p_code: parsed.data.code ?? null,
    p_description: parsed.data.description ?? null,
    p_voucher_type: parsed.data.voucherType,
    p_original_value_grosz: parsed.data.valueGrosz,
    p_valid_from: parsed.data.validFrom,
    p_valid_until: parsed.data.validUntil,
    p_multi_use: parsed.data.multiUse,
    p_allowed_workshop_types: parsed.data.allowedWorkshopTypes,
    p_allowed_workshop_ids: parsed.data.allowedWorkshopIds,
    p_refund_policy: parsed.data.refundPolicy,
  });

  if (error || !data) {
    console.error('admin_issue_voucher failed', error?.message);
    return {
      ok: false,
      message: error?.message?.toLowerCase().includes('duplicate')
        ? 'Taki kod bonu już istnieje.'
        : 'Nie udało się utworzyć bonu.',
    };
  }

  const result = data as { code?: string; generated?: boolean };
  revalidatePath('/admin/vouchery');
  return {
    ok: true,
    message: result.generated
      ? 'Bon utworzony. Skopiuj kod teraz i przekaż klientowi bezpiecznym kanałem.'
      : 'Bon został zaimportowany.',
    issuedCode: result.code,
  };
}

export async function cancelVoucherAction(formData: FormData): Promise<void> {
  await requireAnyRole(['owner', 'manager']);
  const voucherId = z.string().uuid().parse(String(formData.get('voucherId')));
  const supabase = createCartAdminClient() as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { error } = await supabase.rpc('admin_cancel_voucher', {
    p_voucher_id: voucherId,
  });
  if (error) {
    throw new Error(
      error.message.includes('active reservation')
        ? 'Bon jest używany przez oczekującą rezerwację i nie może być anulowany.'
        : 'Nie udało się anulować bonu.'
    );
  }
  revalidatePath('/admin/vouchery');
}

export async function extendVoucherAction(formData: FormData): Promise<void> {
  await requireAnyRole(['owner', 'manager']);
  const voucherId = z.string().uuid().parse(String(formData.get('voucherId')));
  const validUntil = parseDate(formData.get('validUntil'));
  if (!validUntil) throw new Error('Podaj poprawną datę ważności.');

  const supabase = createCartAdminClient() as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { error } = await supabase.rpc('admin_extend_voucher', {
    p_voucher_id: voucherId,
    p_valid_until: validUntil,
  });
  if (error) throw new Error('Nie udało się przedłużyć bonu.');
  revalidatePath('/admin/vouchery');
}

export async function refundVoucherOrderAction(formData: FormData): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const orderId = z.string().uuid().parse(String(formData.get('orderId')));
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000);
  const operationKey = z.string().uuid().parse(String(formData.get('operationKey')));
  if (!reason) throw new Error('Podaj powód zwrotu.');

  const supabase = createCartAdminClient() as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { error } = await supabase.rpc('refund_voucher_only_order', {
    p_order_id: orderId,
    p_reason: reason,
    p_operation_key: `voucher-refund-${operationKey}`,
    p_actor_id: admin.userId,
    p_actor_role: admin.role,
  });
  if (error) {
    console.error('refund_voucher_only_order failed', error.message);
    throw new Error('Nie udało się zwrócić bonu i zwolnić miejsc.');
  }

  revalidatePath('/admin/vouchery');
  revalidatePath(`/admin/zamowienia/${orderId}`);
  revalidatePath('/admin/zamowienia');
}
