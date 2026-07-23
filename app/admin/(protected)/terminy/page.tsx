import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { SessionStatusBadge } from './status-badge';
import { SearchFilters } from './search-filters';
import type { SessionStatus } from '@/lib/database/types';

export const metadata = {
  title: 'Terminy | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function SessionsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['manager']);
  const params = await searchParams;
  const supabase = createClient();

  const workshop = typeof params.workshop === 'string' ? params.workshop : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const instructor =
    typeof params.instructor === 'string' ? params.instructor : '';
  const dateFrom = typeof params.dateFrom === 'string' ? params.dateFrom : '';
  const dateTo = typeof params.dateTo === 'string' ? params.dateTo : '';
  const page = Math.max(1, Number(params.page ?? 1));

  let query = supabase
    .from('workshop_sessions')
    .select(
      'id, workshop_id, instructor_id, starts_at, ends_at, capacity, reserved_count, status, price_gross_grosz',
      { count: 'exact' }
    );

  if (workshop) query = query.eq('workshop_id', workshop);
  if (status) query = query.eq('status', status);
  if (instructor) query = query.eq('instructor_id', instructor);
  if (dateFrom) query = query.gte('starts_at', `${dateFrom}T00:00:00+00:00`);
  if (dateTo) query = query.lte('starts_at', `${dateTo}T23:59:59+00:00`);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: sessions, count } = await query
    .order('starts_at', { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const [{ data: workshops }, { data: instructors }] = await Promise.all([
    supabase.from('workshops').select('id, title'),
    supabase.from('instructors').select('id, display_name'),
  ]);

  const workshopNames = new Map(
    (workshops ?? []).map((w) => [w.id, w.title as string])
  );
  const instructorNames = new Map(
    (instructors ?? []).map((i) => [i.id, i.display_name as string])
  );

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (workshop) next.set('workshop', workshop);
    if (status) next.set('status', status);
    if (instructor) next.set('instructor', instructor);
    if (dateFrom) next.set('dateFrom', dateFrom);
    if (dateTo) next.set('dateTo', dateTo);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/terminy${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Terminy</h1>
        <Link
          href="/admin/terminy/nowy"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowy termin
        </Link>
      </div>

      <SearchFilters
        workshop={workshop}
        status={status}
        instructor={instructor}
        dateFrom={dateFrom}
        dateTo={dateTo}
        workshops={workshops ?? []}
        instructors={instructors ?? []}
      />

      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Data i czas</th>
              <th className="px-4 py-2">Warsztat</th>
              <th className="px-4 py-2">Instruktor</th>
              <th className="px-4 py-2">Miejsca</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {sessions && sessions.length > 0 ? (
              sessions.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    {new Date(row.starts_at).toLocaleString('pl-PL')}
                  </td>
                  <td className="px-4 py-2">
                    {workshopNames.get(row.workshop_id) ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    {row.instructor_id
                      ? (instructorNames.get(row.instructor_id) ?? '—')
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    {row.reserved_count} / {row.capacity}
                  </td>
                  <td className="px-4 py-2">
                    <SessionStatusBadge status={row.status as SessionStatus} />
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/terminy/${row.id}`}
                      className="text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                  Brak terminów pasujących do filtrów.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span>
            Strona {page} z {totalPages} ({count ?? 0} wyników)
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
