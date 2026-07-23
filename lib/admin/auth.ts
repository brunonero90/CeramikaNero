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
 * authenticated or is not an active admin. The result is safe to use in
 * Server Components and Server Actions because it is derived from the
 * cookie-backed session and the database role table.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('role, display_name')
    .eq('user_id', session.user.id)
    .eq('is_active', true)
    .single();

  if (adminError || !admin) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? '',
    role: adminRoleSchema.parse(admin.role),
    displayName: admin.display_name,
  };
}

/**
 * Require an active admin session. Throws a plain error that should be
 * converted into a safe client-facing message by the caller.
 */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new Error('Unauthorized');
  }
  return admin;
}

/**
 * Require an active admin with one of the allowed roles. Owners implicitly
 * pass any role check because they have full access.
 */
export async function requireAnyRole(
  allowedRoles: AdminRole[]
): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (admin.role === 'owner' || allowedRoles.includes(admin.role)) {
    return admin;
  }
  throw new Error('Forbidden');
}

/**
 * Require an active owner. Use for admin user management, site settings and
 * redirects.
 */
export async function requireOwner(): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (admin.role !== 'owner') {
    throw new Error('Forbidden');
  }
  return admin;
}
