import Link from 'next/link';
import { requireAnyRole } from '@/lib/admin/auth';
import { getBookingsAction } from './actions';
import { BookingStatusBadge } from './status-badge';
import { formatPrice } from '@/lib/utils/price';

export const metadata = {
  title: 'Rezerwacje | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function BookingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['owner', 'manager']);
  const params = await searchParams;

  const q = typeof params.q === 'string' ? params.q : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const source = typeof params.source === 'string' ? params.source : '';
  const page = Math.max(1, Number(params.page ?? 1));
  const sort = typeof params.sort === 'string' ? params.sort : 'created_at';
  const order = params.order === 'asc' ? 'asc' : 'desc';
  const allowedSort = ['created_at', 'confirmed_at', 'total_price_gross_grosz'];
  const sortColumn = allowedSort.includes(sort) ? sort : 'created_at';

  const { bookings, count } = await getBookingsAction({
    search: q,
    status,
    source,
    sortBy: sortColumn as
      'created_at' | 'confirmed_at' | 'total_price_gross_grosz',
    sortOrder: order,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (source) next.set('source', source);
    if (sortColumn !== 'created_at') next.set('sort', sortColumn);
    if (order !== 'desc') next.set('order', order);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/rezerwacje${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rezerwacje</h1>
        <Link
          href="/admin/rezerwacje/nowa"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowa rezerwacja
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Szukaj
            </label>
            <input
              name="q"
              defaultValue={q}
              placeholder="numer, e-mail, nazwisko"
              className="rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Status
            </label>
            <select
              name="status"
              defaultValue={status}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="pending">Oczekująca</option>
              <option value="confirmed">Potwierdzona</option>
              <option value="cancelled">Anulowana</option>
              <option value="expired">Wygasła</option>
              <option value="refunded">Zwrócona</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Źródło
            </label>
            <select
              name="source"
              defaultValue={source}
              className="rounded border px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="website">Strona</option>
              <option value="admin">Panel</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
          <Link
            href="/admin/rezerwacje"
            className="text-sm text-gray-600 underline"
          >
            Wyczyść
          </Link>
        </form>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Numer</th>
              <th className="px-4 py-2">Kupujący</th>
              <th className="px-4 py-2">Warsztat</th>
              <th className="px-4 py-2">Termin</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Kwota</th>
              <th className="px-4 py-2">Źródło</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length > 0 ? (
              bookings.map((row) => {
                const profile = row.customer_profiles as {
                  first_name: string;
                  last_name: string;
                  email: string;
                };
                const session = row.workshop_sessions as unknown as {
                  starts_at: string;
                  workshops: { title: string };
                };
                const date = new Date(session.starts_at).toLocaleString(
                  'pl-PL'
                );
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2 font-medium">
                      {row.booking_reference}
                    </td>
                    <td className="px-4 py-2">
                      {profile.first_name} {profile.last_name}
                      <br />
                      <span className="text-xs text-gray-500">
                        {profile.email}
                      </span>
                    </td>
                    <td className="px-4 py-2">{session.workshops.title}</td>
                    <td className="px-4 py-2">{date}</td>
                    <td className="px-4 py-2">
                      <BookingStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.total_price_gross_grosz)}
                    </td>
                    <td className="px-4 py-2">
                      {row.source === 'website' ? 'Strona' : 'Panel'}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/rezerwacje/${row.id}`}
                        className="text-gray-900 underline"
                      >
                        Szczegóły
                      </Link>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-center text-gray-500">
                  Brak rezerwacji pasujących do filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span>
            Strona {page} z {totalPages} ({count} wyników)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildLink({ page: String(page - 1) })}
                className="rounded-md border px-3 py-1"
              >
                Poprzednia
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildLink({ page: String(page + 1) })}
                className="rounded-md border px-3 py-1"
              >
                Następna
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
