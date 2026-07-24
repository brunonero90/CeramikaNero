'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';

export type ResetPasswordActionState =
  { ok: false; error: string } | { ok: true; message: string };

export async function resetPasswordAction(
  _prevState: ResetPasswordActionState | undefined,
  formData: FormData
): Promise<ResetPasswordActionState> {
  const password = formData.get('password')?.toString() ?? '';
  const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

  if (password.length < 8) {
    return { ok: false, error: 'Hasło musi mieć co najmniej 8 znaków.' };
  }

  if (password !== confirmPassword) {
    return { ok: false, error: 'Hasła nie są identyczne.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      ok: false,
      error: 'Nie udało się zresetować hasła. Link mógł wygasnąć.',
    };
  }

  const admin = await getCurrentAdmin();
  if (admin) {
    await recordAuditEvent(supabase, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      action: 'reset_password',
      entityType: 'auth',
      entityId: null,
      summary: 'Administrator reset password',
    });
  }

  redirect('/admin');
}
