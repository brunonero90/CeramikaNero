'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import {
  adminUserInputSchema,
  adminUserRoleChangeSchema,
} from '@/lib/admin/schemas';

export type AdminUserActionState =
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

export async function addAdminUserAction(
  _prevState: AdminUserActionState | undefined,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireOwner();
  const supabase = await createClient();

  const parsed = adminUserInputSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
    displayName: formData.get('displayName'),
    isActive: formData.get('isActive') === 'on',
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  const { error } = await supabase.from('admin_users').insert({
    user_id: data.userId,
    role: data.role,
    display_name: data.displayName,
    is_active: data.isActive,
  });

  if (error) {
    return {
      ok: false,
      errors: {},
      formError:
        'Nie udało się dodać użytkownika. Upewnij się, że podano prawidłowy UUID użytkownika Supabase Auth.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'add_admin_user',
    entityType: 'admin_user',
    entityId: data.userId,
    summary: `Added admin user ${data.displayName} as ${data.role}`,
    changedFields: { role: data.role, displayName: data.displayName },
  });

  revalidatePath('/admin/uzytkownicy');
  return { ok: true, message: 'Użytkownik został dodany.' };
}

export async function updateAdminUserAction(
  userId: string,
  _prevState: AdminUserActionState | undefined,
  formData: FormData
): Promise<AdminUserActionState> {
  const admin = await requireOwner();
  const supabase = await createClient();

  const parsed = adminUserRoleChangeSchema.safeParse({
    userId,
    role: formData.get('role'),
    isActive: formData.get('isActive') === 'on',
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  // Prevent deactivating the last active owner.
  if (!data.isActive || data.role !== 'owner') {
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'owner')
      .eq('is_active', true);

    const isTarget = userId === admin.userId;
    const activeOwners = count ?? 0;

    if (isTarget && activeOwners <= 1) {
      return {
        ok: false,
        errors: {},
        formError: 'Nie można dezaktywować jedynego aktywnego właściciela.',
      };
    }
  }

  const { error } = await supabase
    .from('admin_users')
    .update({ role: data.role, is_active: data.isActive })
    .eq('user_id', userId);

  if (error) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się zaktualizować użytkownika.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_admin_user',
    entityType: 'admin_user',
    entityId: userId,
    summary: `Updated admin user role/activity`,
    changedFields: { role: data.role, is_active: data.isActive },
  });

  revalidatePath('/admin/uzytkownicy');
  return { ok: true, message: 'Użytkownik został zaktualizowany.' };
}
