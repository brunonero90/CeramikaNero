import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { deleteRedirectAction } from './actions';

export const metadata = {
  title: 'Przekierowania | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function RedirectsPage() {
  await requireOwner();
  const supabase = await createClient();
  const { data: redirects } = await supabase
    .from('legacy_redirects')
    .select('id, source_path, destination_path, status_code')
    .order('source_path', { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Przekierowania</h1>
        <Link
          href="/admin/przekierowania/nowa"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowe przekierowanie
        </Link>
      </div>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Źródło</th>
              <th className="px-4 py-2">Cel</th>
              <th className="px-4 py-2">Kod</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {redirects && redirects.length > 0 ? (
              redirects.map((redirect) => (
                <tr key={redirect.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">{redirect.source_path}</td>
                  <td className="px-4 py-2">{redirect.destination_path}</td>
                  <td className="px-4 py-2">{redirect.status_code}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/przekierowania/${redirect.id}`}
                      className="mr-3 text-gray-900 underline"
                    >
                      Edytuj
                    </Link>
                    <form
                      action={deleteRedirectAction.bind(null, redirect.id)}
                      className="inline"
                    >
                      <button
                        type="submit"
                        className="text-red-600 underline"
                        onClick={(e) => {
                          if (!confirm('Usunąć to przekierowanie?')) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Usuń
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                  Brak przekierowań.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
