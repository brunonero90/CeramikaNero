'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { siteSettingsInputSchema } from '@/lib/admin/schemas';

export type SettingsActionState =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

const SETTING_KEYS = [
  'studio_name',
  'studio_address',
  'studio_email',
  'studio_phone',
  'booking_cta_label',
  'default_seo_title',
  'default_seo_description',
] as const;

export async function updateSettingsAction(
  _prevState: SettingsActionState | undefined,
  formData: FormData
): Promise<SettingsActionState> {
  const admin = await requireOwner();
  const supabase = createClient();

  const parsed = siteSettingsInputSchema.safeParse({
    studioName: formData.get('studioName'),
    studioAddress: formData.get('studioAddress'),
    studioEmail: formData.get('studioEmail'),
    studioPhone: formData.get('studioPhone'),
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
  const keyValueMap: Record<string, unknown> = {
    studio_name: values.studioName,
    studio_address: values.studioAddress,
    studio_email: values.studioEmail,
    studio_phone: values.studioPhone,
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
  return { ok: true, message: 'Ustawienia zostały zapisane.' };
}
