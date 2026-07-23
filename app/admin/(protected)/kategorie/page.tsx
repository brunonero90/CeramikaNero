import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';

export const metadata = {
  title: 'Kategorie | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  await requireAnyRole(['manager']);
  const supabase = createClient();
  const { data: categories } = await supabase
    .from('workshop_categories')
    .select('id, name, slug, suggested_theme, is_visible, display_order')
    .order('display_order', { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kategorie</h1>
        <Link
          href="/admin/kategorie/nowa"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Nowa kategoria
        </Link>
      </div>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Nazwa</th>
              <th className="px-4 py-2">Slug</th>
              <th className="px-4 py-2">Motyw</th>
              <th className="px-4 py-2">Widoczna</th>
              <th className="px-4 py-2">Kolejność</th>
              <th className="px-4 py-2">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {categories && categories.length > 0 ? (
              categories.map((category) => (
                <tr key={category.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium">{category.name}</td>
                  <td className="px-4 py-2">{category.slug}</td>
                  <td className="px-4 py-2">{category.suggested_theme}</td>
                  <td className="px-4 py-2">
                    {category.is_visible ? 'Tak' : 'Nie'}
                  </td>
                  <td className="px-4 py-2">{category.display_order}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/kategorie/${category.id}`}
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
                  Brak kategorii.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
