import { createClient } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/database/types';
import { adminRoleSchema } from '@/lib/database/schema';

export type CurrentAdmin = {
  userId: string;
  email: string;
  role: AdminRole;
  displayName: string;
};

/**
 * Return the current active administrator, or null if the user is not
 * authenticated or is not an active admin. Derived from the cookie-backed
 * session and admin_users — never from a client-supplied email alone.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('role, display_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError || !admin) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    role: adminRoleSchema.parse(admin.role),
    displayName: admin.display_name,
  };
}

/**
 * Require an active admin session. Throws when unauthorized so Server Actions
 * that forget to check still fail closed. Prefer getCurrentAdmin() + redirect
 * in layouts/pages for navigation UX.
 */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}

export async function requireAnyRole(
  allowedRoles: AdminRole[]
): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (admin.role === 'owner' || allowedRoles.includes(admin.role)) {
    return admin;
  }
  throw new Error('Forbidden');
}

export async function requireOwner(): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') {
    throw new Error('Forbidden');
  }
  return admin;
}
