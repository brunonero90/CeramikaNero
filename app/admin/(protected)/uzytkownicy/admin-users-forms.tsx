'use client';

import { useActionState } from 'react';
import {
  addAdminUserAction,
  updateAdminUserAction,
  type AdminUserActionState,
} from './actions';
import type { AdminRole } from '@/lib/database/types';

type AdminUserRow = {
  user_id: string;
  role: AdminRole;
  display_name: string;
  is_active: boolean;
  last_login_at: string | null;
};

export function AddAdminUserForm() {
  const [state, dispatch, isPending] = useActionState<
    AdminUserActionState | undefined,
    FormData
  >(addAdminUserAction, undefined);

  return (
    <form action={dispatch} className="max-w-2xl space-y-3">
      {state?.ok && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-700"
          role="status"
        >
          {state.message}
        </p>
      )}
      {!state?.ok && state?.formError && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {state.formError}
        </p>
      )}
      <div>
        <label htmlFor="userId" className="block text-sm font-medium">
          UUID użytkownika Supabase Auth
        </label>
        <input
          id="userId"
          name="userId"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Wyświetlana nazwa
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          Rola
        </label>
        <select
          id="role"
          name="role"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="editor">Redaktor</option>
          <option value="manager">Menedżer</option>
          <option value="owner">Właściciel</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked
          className="h-4 w-4"
        />
        <label htmlFor="isActive" className="text-sm font-medium">
          Aktywny
        </label>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Zapisywanie…' : 'Dodaj'}
      </button>
    </form>
  );
}

export function AdminUserList({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b bg-gray-50">
        <tr>
          <th className="px-4 py-2">Nazwa</th>
          <th className="px-4 py-2">Rola</th>
          <th className="px-4 py-2">Aktywny</th>
          <th className="px-4 py-2">Ostatnie logowanie</th>
          <th className="px-4 py-2">Akcje</th>
        </tr>
      </thead>
      <tbody>
        {users.length > 0 ? (
          users.map((user) => (
            <AdminUserRowForm
              key={user.user_id}
              user={user}
              currentUserId={currentUserId}
            />
          ))
        ) : (
          <tr>
            <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
              Brak użytkowników administracyjnych.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function AdminUserRowForm({
  user,
  currentUserId,
}: {
  user: AdminUserRow;
  currentUserId: string;
}) {
  const [state, dispatch, isPending] = useActionState<
    AdminUserActionState | undefined,
    FormData
  >(updateAdminUserAction.bind(null, user.user_id), undefined);

  const isOnlyOwner = currentUserId === user.user_id && user.role === 'owner';

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-2 font-medium">{user.display_name}</td>
      <td className="px-4 py-2">{user.role}</td>
      <td className="px-4 py-2">{user.is_active ? 'Tak' : 'Nie'}</td>
      <td className="px-4 py-2">{user.last_login_at ?? '—'}</td>
      <td className="px-4 py-2">
        <form action={dispatch} className="space-y-2">
          {!state?.ok && state?.formError && (
            <p className="text-xs text-red-600">{state.formError}</p>
          )}
          <div className="flex items-center gap-2">
            <select
              name="role"
              defaultValue={user.role}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="editor">Redaktor</option>
              <option value="manager">Menedżer</option>
              <option value="owner">Właściciel</option>
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={user.is_active}
                disabled={isOnlyOwner}
              />
              Aktywny
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Zapisz
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}
