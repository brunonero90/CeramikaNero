import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { InstructorStatusBadge } from './status-badge';

export const metadata = {
  title: 'Instruktorzy | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function InstructorsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['manager']);
  const params = await searchParams;
  const supabase = await createClient();

  const q = typeof params.q === 'string' ? params.q : '';
  const page = Math.max(1, Number(params.page ?? 1));

  let query = supabase
    .from('instructors')
    .select('id, display_name, slug, is_active, display_order', {
      count: 'exact',
    });

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,slug.ilike.%${q}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: instructors, count } = await query
    .order('display_order', { ascending: true })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/instruktorzy${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Instruktorzy</h1>
        <Link
          href="/admin/instruktorzy/nowy"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowy instruktor
        </Link>
      </div>

      <form method="GET" className="rounded-lg border bg-white p-4">
        <div className="flex gap-2">
          <input
            name="q"
            type="text"
            defaultValue={q}
            placeholder="Szukaj..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Szukaj
          </button>
          <Link
            href="/admin/instruktorzy"
            className="rounded-md border px-4 py-2 text-sm"
          >
            Wyczyść
          </Link>
        </div>
      </form>

      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Nazwa</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Kolejność</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {instructors && instructors.length > 0 ? (
              instructors.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{row.display_name}</td>
                  <td className="px-4 py-2">{row.slug}</td>
                  <td className="px-4 py-2">
                    <InstructorStatusBadge isActive={row.is_active} />
                  </td>
                  <td className="px-4 py-2">{row.display_order}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/instruktorzy/${row.id}`}
                      className="text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                  Brak instruktorów.
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
