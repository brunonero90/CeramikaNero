'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { siteSettingsInputSchema } from '@/lib/admin/schemas';
import type { Json } from '@/lib/database/types';

export type SettingsActionState =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

const SETTING_KEYS = [
  'studio_name',
  'studio_address',
  'studio_email',
  'studio_phone',
  'whatsapp_url',
  'facebook_url',
  'instagram_url',
  'bank_transfer_instructions',
  'bank_transfer_enabled',
  'bank_transfer_recipient',
  'bank_transfer_account',
  'bank_transfer_bank_name',
  'bank_transfer_title_template',
  'bank_transfer_deadline_note',
  'delivery_quote_wording',
  'public_notice',
  'booking_cta_label',
  'default_seo_title',
  'default_seo_description',
] as const;

export async function updateSettingsAction(
  _prevState: SettingsActionState | undefined,
  formData: FormData
): Promise<SettingsActionState> {
  const admin = await requireOwner();
  const supabase = await createClient();

  const parsed = siteSettingsInputSchema.safeParse({
    studioName: formData.get('studioName'),
    studioAddress: formData.get('studioAddress'),
    studioEmail: formData.get('studioEmail'),
    studioPhone: formData.get('studioPhone'),
    whatsappUrl: formData.get('whatsappUrl') || '',
    facebookUrl: formData.get('facebookUrl') || '',
    instagramUrl: formData.get('instagramUrl') || '',
    bankTransferInstructions: formData.get('bankTransferInstructions') || '',
    bankTransferEnabled: formData.get('bankTransferEnabled') === 'true',
    bankTransferRecipient: formData.get('bankTransferRecipient') || '',
    bankTransferAccount: formData.get('bankTransferAccount') || '',
    bankTransferBankName: formData.get('bankTransferBankName') || '',
    bankTransferTitleTemplate:
      formData.get('bankTransferTitleTemplate') || '{{order_reference}}',
    bankTransferDeadlineNote: formData.get('bankTransferDeadlineNote') || '',
    deliveryQuoteWording: formData.get('deliveryQuoteWording') || '',
    publicNotice: formData.get('publicNotice') || '',
    bookingCtaLabel: formData.get('bookingCtaLabel'),
    defaultSeoTitle: formData.get('defaultSeoTitle'),
    defaultSeoDescription: formData.get('defaultSeoDescription'),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const values = parsed.data;
  const keyValueMap: Record<string, Json> = {
    studio_name: values.studioName,
    studio_address: values.studioAddress,
    studio_email: values.studioEmail,
    studio_phone: values.studioPhone,
    whatsapp_url: values.whatsappUrl,
    facebook_url: values.facebookUrl,
    instagram_url: values.instagramUrl,
    bank_transfer_instructions: values.bankTransferInstructions,
    bank_transfer_enabled: values.bankTransferEnabled ? 'true' : 'false',
    bank_transfer_recipient: values.bankTransferRecipient,
    bank_transfer_account: values.bankTransferAccount,
    bank_transfer_bank_name: values.bankTransferBankName,
    bank_transfer_title_template: values.bankTransferTitleTemplate,
    bank_transfer_deadline_note: values.bankTransferDeadlineNote,
    delivery_quote_wording: values.deliveryQuoteWording,
    public_notice: values.publicNotice,
    booking_cta_label: values.bookingCtaLabel,
    default_seo_title: values.defaultSeoTitle,
    default_seo_description: values.defaultSeoDescription,
  };

  const upserts = SETTING_KEYS.map((key) => ({
    key,
    value: keyValueMap[key],
    description: null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('site_settings').upsert(upserts, {
    onConflict: 'key',
    ignoreDuplicates: false,
  });

  if (error) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się zapisać ustawień.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_settings',
    entityType: 'site_setting',
    entityId: null,
    summary: 'Updated site settings',
    changedFields: { keys: SETTING_KEYS },
  });

  revalidatePath('/admin/ustawienia');
  revalidatePath('/');
  revalidatePath('/kontakt');
  return { ok: true, message: 'Ustawienia zostały zapisane.' };
}
