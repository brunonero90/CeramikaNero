import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { groszToZloty } from '@/lib/utils/money';
import { WorkshopStatusBadge } from './status-badge';
import { SearchFilters } from './search-filters';
import type { ContentStatus } from '@/lib/database/types';

export const metadata = {
  title: 'Warsztaty | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function WorkshopsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['manager']);
  const params = await searchParams;
  const supabase = createClient();

  const q = typeof params.q === 'string' ? params.q : '';
  const category = typeof params.category === 'string' ? params.category : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page ?? 1));
  const sort = typeof params.sort === 'string' ? params.sort : 'updated_at';
  const order = params.order === 'asc' ? 'asc' : 'desc';

  const allowedSort = ['updated_at', 'title', 'created_at', 'status'];
  const sortColumn = allowedSort.includes(sort) ? sort : 'updated_at';

  let query = supabase
    .from('workshops')
    .select(
      'id, title, slug, status, archived_at, default_price_gross_grosz, category_id, updated_at',
      {
        count: 'exact',
      }
    );

  if (q) {
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (category) {
    query = query.eq('category_id', category);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: workshops, count } = await query
    .order(sortColumn, { ascending: order === 'asc' })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const { data: categories } = await supabase
    .from('workshop_categories')
    .select('id, name');

  const categoryNames = new Map(
    (categories ?? []).map((c) => [c.id, c.name as string])
  );

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (category) next.set('category', category);
    if (status) next.set('status', status);
    if (sortColumn !== 'updated_at') next.set('sort', sortColumn);
    if (order !== 'desc') next.set('order', order);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/warsztaty${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Warsztaty</h1>
        <Link
          href="/admin/warsztaty/nowy"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowy warsztat
        </Link>
      </div>

      <SearchFilters
        q={q}
        category={category}
        status={status}
        categories={categories ?? []}
      />

      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">
                <Link
                  href={buildLink({
                    sort: 'title',
                    order:
                      sortColumn === 'title' && order === 'desc'
                        ? 'asc'
                        : 'desc',
                  })}
                >
                  Tytuł
                </Link>
              </th>
              <th className="px-4 py-2">Kategoria</th>
              <th className="px-4 py-2">
                <Link
                  href={buildLink({
                    sort: 'status',
                    order:
                      sortColumn === 'status' && order === 'desc'
                        ? 'asc'
                        : 'desc',
                  })}
                >
                  Status
                </Link>
              </th>
              <th className="px-4 py-2">Cena</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {workshops && workshops.length > 0 ? (
              workshops.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{row.title}</td>
                  <td className="px-4 py-2">
                    {categoryNames.get(row.category_id) ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <WorkshopStatusBadge
                      status={row.status as ContentStatus}
                      archivedAt={row.archived_at}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {groszToZloty(row.default_price_gross_grosz)} zł
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/warsztaty/${row.id}`}
                      className="text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                    <Link
                      href={`/warsztaty/${row.slug}`}
                      target="_blank"
                      className="ml-2 text-gray-900 underline"
                    >
                      Podgląd
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Brak warsztatów pasujących do filtrów.
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
