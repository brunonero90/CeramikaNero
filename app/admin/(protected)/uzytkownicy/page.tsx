import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { AddAdminUserForm, AdminUserList } from './admin-users-forms';
import type { AdminRole } from '@/lib/database/types';

export const metadata = {
  title: 'Użytkownicy | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const currentAdmin = await requireOwner();
  const supabase = createClient();
  const { data: users } = await supabase
    .from('admin_users')
    .select('user_id, role, display_name, is_active, last_login_at')
    .order('display_name', { ascending: true });

  const typedUsers = (users ?? []).map((user) => ({
    ...user,
    role: user.role as AdminRole,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Użytkownicy administracyjni</h1>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Dodaj użytkownika</h2>
        <AddAdminUserForm />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Lista użytkowników</h2>
        <AdminUserList users={typedUsers} currentUserId={currentAdmin.userId} />
      </section>
    </div>
  );
}
