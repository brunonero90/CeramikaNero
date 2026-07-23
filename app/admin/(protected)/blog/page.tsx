import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { BlogPostStatusBadge } from './status-badge';
import type { ContentStatus } from '@/lib/database/types';

export const metadata = {
  title: 'Blog | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['editor', 'manager']);
  const params = await searchParams;
  const supabase = createClient();

  const q = typeof params.q === 'string' ? params.q : '';
  const status = typeof params.status === 'string' ? params.status : '';
  const page = Math.max(1, Number(params.page ?? 1));

  let query = supabase
    .from('blog_posts')
    .select('id, title, slug, status, archived_at, published_at, updated_at', {
      count: 'exact',
    });

  if (q) {
    query = query.or(`title.ilike.%${q}%,slug.ilike.%${q}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: posts, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/blog${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <Link
          href="/admin/blog/nowy"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowy wpis
        </Link>
      </div>

      <form method="GET" className="rounded-lg border bg-white p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="q" className="block text-sm font-medium">
              Szukaj
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={q}
              placeholder="Tytuł lub slug"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="status" className="block text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="draft">Szkic</option>
              <option value="published">Opublikowany</option>
              <option value="archived">Zarchiwizowany</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
          <Link
            href="/admin/blog"
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
              <th className="px-4 py-2">Tytuł</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Data publikacji</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {posts && posts.length > 0 ? (
              posts.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{row.title}</td>
                  <td className="px-4 py-2">
                    <BlogPostStatusBadge
                      status={row.status as ContentStatus}
                      archivedAt={row.archived_at}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {row.published_at
                      ? new Date(row.published_at).toLocaleString('pl-PL')
                      : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/blog/${row.id}`}
                      className="text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                    <Link
                      href={`/admin/blog/${row.id}/podglad`}
                      className="ml-2 text-gray-900 underline"
                    >
                      Podgląd
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                  Brak wpisów pasujących do filtrów.
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
