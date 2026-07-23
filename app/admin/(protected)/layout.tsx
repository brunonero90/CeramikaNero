import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminHeader } from './components/admin-header';
import { Sidebar } from './components/sidebar';
import { Breadcrumbs } from './components/breadcrumbs';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  if (!admin) {
    redirect('/admin/login');
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AdminHeader admin={admin} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={admin.role} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
