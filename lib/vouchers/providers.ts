import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';

export type VoucherProviderCode = string;

export type ExternalVoucherValidation = {
  valid: boolean;
  providerReference: string;
  description: string | null;
  voucherType: 'fixed_amount' | 'workshop_specific' | 'experience';
  originalValueGrosz: number;
  remainingValueGrosz: number;
  currency: 'PLN';
  validFrom: string | null;
  validUntil: string | null;
  multiUse: boolean;
  allowedWorkshopTypes: string[];
  allowedWorkshopIds: string[];
  metadata: Record<string, unknown>;
};

export type ExternalVoucherMutation = {
  ok: boolean;
  providerReference: string;
  status: string;
};

export interface VoucherProvider {
  readonly code: VoucherProviderCode;
  validateVoucher(code: string): Promise<ExternalVoucherValidation>;
  redeemVoucher(input: {
    code: string;
    amountGrosz: number;
    idempotencyKey: string;
  }): Promise<ExternalVoucherMutation>;
  cancelRedemption(input: {
    code: string;
    providerReference: string;
    idempotencyKey: string;
  }): Promise<ExternalVoucherMutation>;
}

const externalResponseSchema = z.object({
  valid: z.boolean(),
  provider_reference: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  voucher_type: z
    .enum(['fixed_amount', 'workshop_specific', 'experience'])
    .default('fixed_amount'),
  original_value_grosz: z.number().int().positive(),
  remaining_value_grosz: z.number().int().nonnegative(),
  currency: z.literal('PLN'),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  multi_use: z.boolean().default(true),
  allowed_workshop_types: z.array(z.string().min(1).max(120)).default([]),
  allowed_workshop_ids: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

const externalMutationSchema = z.object({
  ok: z.boolean(),
  provider_reference: z.string().min(1).max(200),
  status: z.string().min(1).max(120),
});

type ProviderRow = {
  code: string;
  name: string;
  adapter_type: 'database' | 'http_json';
  api_base_url: string | null;
  api_secret_env_key: string | null;
  config: Record<string, unknown> | null;
  is_active: boolean;
};

export function normalizeVoucherCode(code: string): string {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function maskVoucherCode(code: string): string {
  const normalized = normalizeVoucherCode(code);
  return `••••${normalized.slice(-4)}`;
}

export function voucherRequestFingerprint(code: string): string {
  return createHash('sha256')
    .update(normalizeVoucherCode(code))
    .digest('hex')
    .slice(0, 16);
}

export function isAllowedVoucherProviderUrl(
  url: string,
  allowedHosts: string[]
): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      allowedHosts.some((host) => parsed.hostname === host.toLowerCase())
    );
  } catch {
    return false;
  }
}

class HttpJsonVoucherProvider implements VoucherProvider {
  readonly code: string;

  constructor(private readonly row: ProviderRow) {
    this.code = row.code;
  }

  private async request(payload: Record<string, unknown>): Promise<unknown> {
    const endpoint = this.row.api_base_url?.trim();
    if (!endpoint) throw new Error('provider_not_configured');

    const allowedHosts = (process.env.VOUCHER_PROVIDER_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (!isAllowedVoucherProviderUrl(endpoint, allowedHosts)) {
      throw new Error('provider_host_not_allowed');
    }

    const secretEnvKey = this.row.api_secret_env_key?.trim();
    const secret = secretEnvKey ? process.env[secretEnvKey]?.trim() : null;
    if (secretEnvKey && !secret) throw new Error('provider_secret_missing');

    const timeoutMsRaw = Number(this.row.config?.timeout_ms ?? 5000);
    const timeoutMs = Number.isFinite(timeoutMsRaw)
      ? Math.min(Math.max(timeoutMsRaw, 1000), 10000)
      : 5000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async validateVoucher(code: string): Promise<ExternalVoucherValidation> {
    const parsed = externalResponseSchema.safeParse(
      await this.request({
        action: 'validate',
        code: normalizeVoucherCode(code),
      })
    );
    if (!parsed.success) {
      throw new Error('provider_response_invalid');
    }
    const value = parsed.data;
    return {
      valid: value.valid,
      providerReference: value.provider_reference,
      description: value.description ?? null,
      voucherType: value.voucher_type,
      originalValueGrosz: value.original_value_grosz,
      remainingValueGrosz: value.remaining_value_grosz,
      currency: value.currency,
      validFrom: value.valid_from ?? null,
      validUntil: value.valid_until ?? null,
      multiUse: value.multi_use,
      allowedWorkshopTypes: value.allowed_workshop_types,
      allowedWorkshopIds: value.allowed_workshop_ids,
      metadata: value.metadata,
    };
  }

  async redeemVoucher(input: {
    code: string;
    amountGrosz: number;
    idempotencyKey: string;
  }): Promise<ExternalVoucherMutation> {
    const parsed = externalMutationSchema.safeParse(
      await this.request({
        action: 'redeem',
        code: normalizeVoucherCode(input.code),
        amount_grosz: input.amountGrosz,
        idempotency_key: input.idempotencyKey,
      })
    );
    if (!parsed.success) throw new Error('provider_response_invalid');
    return {
      ok: parsed.data.ok,
      providerReference: parsed.data.provider_reference,
      status: parsed.data.status,
    };
  }

  async cancelRedemption(input: {
    code: string;
    providerReference: string;
    idempotencyKey: string;
  }): Promise<ExternalVoucherMutation> {
    const parsed = externalMutationSchema.safeParse(
      await this.request({
        action: 'cancel',
        code: normalizeVoucherCode(input.code),
        provider_reference: input.providerReference,
        idempotency_key: input.idempotencyKey,
      })
    );
    if (!parsed.success) throw new Error('provider_response_invalid');
    return {
      ok: parsed.data.ok,
      providerReference: parsed.data.provider_reference,
      status: parsed.data.status,
    };
  }
}

async function loadProvider(providerCode: string): Promise<ProviderRow | null> {
  const supabase = createCartAdminClient() as unknown as {
    from: (table: string) => any;
  };
  const { data } = await supabase
    .from('gift_voucher_providers')
    .select(
      'code, name, adapter_type, api_base_url, api_secret_env_key, config, is_active'
    )
    .eq('code', providerCode)
    .eq('is_active', true)
    .maybeSingle();
  return (data as ProviderRow | null) ?? null;
}

async function logProviderFailure(input: {
  providerCode: string;
  code: string;
  errorCode: string;
}) {
  const supabase = createCartAdminClient() as unknown as {
    from: (table: string) => any;
  };
  await supabase.from('voucher_provider_logs').insert({
    provider_code: input.providerCode,
    action: 'api_error',
    request_fingerprint: voucherRequestFingerprint(input.code),
    response_summary: {},
    success: false,
    error_code: input.errorCode.slice(0, 120),
  });
}

/**
 * For database/offline providers the code must already have been imported.
 * HTTP providers use one normalized JSON contract, then cache the successful
 * validation in the local voucher ledger before checkout continues.
 */
export async function ensureExternalVoucherLoaded(input: {
  providerCode?: string | null;
  code: string;
}): Promise<void> {
  const providerCode = input.providerCode?.trim();
  if (!providerCode || providerCode === 'auto') return;

  const row = await loadProvider(providerCode);
  if (!row) throw new Error('provider_unavailable');
  if (row.adapter_type === 'database') return;

  const provider: VoucherProvider = new HttpJsonVoucherProvider(row);
  let validation: ExternalVoucherValidation;
  try {
    validation = await provider.validateVoucher(input.code);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'provider_error';
    await logProviderFailure({
      providerCode,
      code: input.code,
      errorCode: code,
    });
    throw error;
  }

  if (!validation.valid) throw new Error('voucher_invalid');

  const supabase = createCartAdminClient() as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { error } = await supabase.rpc('register_external_voucher', {
    p_provider_code: providerCode,
    p_code: normalizeVoucherCode(input.code),
    p_provider_reference: validation.providerReference,
    p_description: validation.description,
    p_voucher_type: validation.voucherType,
    p_original_value_grosz: validation.originalValueGrosz,
    p_remaining_value_grosz: validation.remainingValueGrosz,
    p_currency: validation.currency,
    p_valid_from: validation.validFrom,
    p_valid_until: validation.validUntil,
    p_multi_use: validation.multiUse,
    p_allowed_workshop_types: validation.allowedWorkshopTypes,
    p_allowed_workshop_ids: validation.allowedWorkshopIds,
    p_metadata: validation.metadata,
  });
  if (error) throw new Error('provider_cache_failed');
}
