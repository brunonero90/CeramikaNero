'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recordAuditEvent } from '@/lib/admin/audit';
import { getCurrentAdmin } from '@/lib/admin/auth';

export type LoginActionState =
  { ok: false; error: string } | { ok: true; redirect: string };

export async function loginAction(
  _prevState: LoginActionState | undefined,
  formData: FormData
): Promise<LoginActionState> {
  const email = formData.get('email')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!email || !password) {
    return { ok: false, error: 'Email i hasło są wymagane.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: 'Nieprawidłowy email lub hasło.' };
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', data.user.id)
    .single();

  if (!admin || !admin.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error: 'To konto nie ma uprawnień administratora lub jest nieaktywne.',
    };
  }

  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('user_id', data.user.id);

  await recordAuditEvent(supabase, {
    actorUserId: data.user.id,
    actorRole: admin.role,
    action: 'login',
    entityType: 'auth',
    entityId: null,
    summary: 'Administrator logged in',
    requestMetadata: { email: email.toLowerCase() },
  });

  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  const supabase = createClient();
  const admin = await getCurrentAdmin();
  await supabase.auth.signOut();

  if (admin) {
    await recordAuditEvent(supabase, {
      actorUserId: admin.userId,
      actorRole: admin.role,
      action: 'logout',
      entityType: 'auth',
      entityId: null,
      summary: 'Administrator logged out',
    });
  }

  redirect('/admin/login');
}
