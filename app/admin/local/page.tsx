import { redirect } from 'next/navigation';
import {
  isBookingLocalMode,
  LOCAL_BOOKING_BANNER,
} from '@/lib/booking/local-mode';
import {
  isLocalAdminAuthenticated,
  isLocalAdminConfigured,
} from '@/lib/booking/local-admin-auth';
import { localAdminLoginAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function LocalAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!isBookingLocalMode()) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold">Panel lokalny wyłączony</h1>
        <p className="mt-4 text-sm text-text-muted">
          Ustaw <code>BOOKING_LOCAL_MODE=1</code> oraz{' '}
          <code>LOCAL_ADMIN_SECRET</code> w pliku <code>.env</code>, a następnie
          uruchom ponownie serwer deweloperski. Ten panel nigdy nie działa w
          produkcji i nie mutuje Supabase.
        </p>
      </main>
    );
  }

  if (await isLocalAdminAuthenticated()) {
    redirect('/admin/local/dashboard');
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {LOCAL_BOOKING_BANNER}
      </p>
      <h1 className="text-2xl font-semibold">Lokalny panel rezerwacji</h1>
      <p className="mt-2 text-sm text-text-muted">
        Osobny od produkcyjnego Supabase Auth. Hasło pochodzi z{' '}
        <code>LOCAL_ADMIN_SECRET</code>.
      </p>
      {error === 'auth' ? (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
          Nieprawidłowe hasło lokalnego admina.
        </p>
      ) : null}
      {!isLocalAdminConfigured() ? (
        <p className="mt-6 rounded bg-red-50 p-3 text-sm text-red-700">
          Brak <code>LOCAL_ADMIN_SECRET</code> (min. 8 znaków) w środowisku.
        </p>
      ) : (
        <form action={localAdminLoginAction} className="mt-8 space-y-4">
          <label className="block text-sm font-medium">
            Hasło lokalne
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="mt-1 w-full rounded border px-3 py-2"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-accent-primary px-5 py-3 text-sm font-semibold text-white uppercase"
          >
            Zaloguj
          </button>
        </form>
      )}
    </main>
  );
}
