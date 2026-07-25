'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recordAuditEvent } from '@/lib/admin/audit';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { adminRoleSchema } from '@/lib/database/schema';

export type LoginActionState =
  { ok: false; error: string } | { ok: true; redirectTo: string };

/**
 * Authenticate and authorize an administrator.
 *
 * Returns a redirect target instead of calling redirect() so useActionState
 * clients can navigate reliably (Next.js redirect-from-action + useActionState
 * often leaves the browser on the login page with no error).
 */
export async function loginAction(
  _prevState: LoginActionState | undefined,
  formData: FormData
): Promise<LoginActionState> {
  const email = formData.get('email')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!email || !password) {
    return { ok: false, error: 'Email i hasło są wymagane.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { ok: false, error: 'Nieprawidłowy email lub hasło.' };
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (adminError || !admin || !admin.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        'Logowanie powiodło się, ale to konto nie ma aktywnych uprawnień administratora.',
    };
  }

  // Best-effort; non-owners may be blocked by RLS from updating last_login_at.
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('user_id', data.user.id);

  await recordAuditEvent(supabase, {
    actorUserId: data.user.id,
    actorRole: adminRoleSchema.parse(admin.role),
    action: 'login',
    entityType: 'auth',
    entityId: null,
    summary: 'Administrator logged in',
    requestMetadata: { email: email.toLowerCase() },
  });

  revalidatePath('/admin', 'layout');
  return { ok: true, redirectTo: '/admin' };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
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
