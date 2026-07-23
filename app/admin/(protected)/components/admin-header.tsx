import { MobileNavigation } from './mobile-navigation';
import { logoutAction } from '@/app/admin/login/actions';
import type { CurrentAdmin } from '@/lib/admin/auth';

const roleLabels: Record<CurrentAdmin['role'], string> = {
  owner: 'Właściciel',
  manager: 'Menedżer',
  editor: 'Redaktor',
};

export function AdminHeader({ admin }: { admin: CurrentAdmin }) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-4 py-3">
      <div className="flex items-center gap-4">
        <MobileNavigation role={admin.role} />
        <span className="text-lg font-semibold">Ceramika Nero</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="hidden text-gray-600 sm:inline">
          {admin.displayName} ({roleLabels[admin.role]})
        </span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
          >
            Wyloguj
          </button>
        </form>
      </div>
    </header>
  );
}
