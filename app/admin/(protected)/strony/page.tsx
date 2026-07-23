import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';

export const metadata = {
  title: 'Strony | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function PagesPage() {
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();
  const { data: pages } = await supabase
    .from('content_pages')
    .select('id, title, slug, status, published_at, archived_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Strony</h1>
        <Link
          href="/admin/strony/nowa"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowa strona
        </Link>
      </div>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Tytuł</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {pages && pages.length > 0 ? (
              pages.map((page) => (
                <tr key={page.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{page.title}</td>
                  <td className="px-4 py-2">/{page.slug}</td>
                  <td className="px-4 py-2">
                    {page.status}
                    {page.archived_at ? ' (zarchiwizowana)' : ''}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/strony/${page.id}`}
                      className="text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                  Brak stron.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
