'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recordAuditEvent } from '@/lib/admin/audit';
import { getCurrentAdmin } from '@/lib/admin/auth';
import { adminRoleSchema } from '@/lib/database/schema';

export type LoginActionState =
  | { ok: false; error: string }
  | { ok: true; redirectTo: string };

/**
 * After the browser client establishes the Supabase session cookies, verify
 * admin membership and record login. Returns a redirect target for a full
 * page navigation (soft App Router redirects were unreliable here).
 */
export async function finalizeAdminLoginAction(): Promise<LoginActionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      error: 'Sesja nie została utworzona. Spróbuj ponownie.',
    };
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminError || !admin || !admin.is_active) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        'Logowanie powiodło się, ale to konto nie ma aktywnych uprawnień administratora.',
    };
  }

  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('user_id', user.id);

  await recordAuditEvent(supabase, {
    actorUserId: user.id,
    actorRole: adminRoleSchema.parse(admin.role),
    action: 'login',
    entityType: 'auth',
    entityId: null,
    summary: 'Administrator logged in',
    requestMetadata: { email: (user.email ?? '').toLowerCase() },
  });

  revalidatePath('/admin', 'layout');
  return { ok: true, redirectTo: '/admin' };
}

/** @deprecated Prefer browser sign-in + finalizeAdminLoginAction. */
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

  return finalizeAdminLoginAction();
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
