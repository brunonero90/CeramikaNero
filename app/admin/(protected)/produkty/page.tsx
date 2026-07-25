import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('products')
    .select(
      'id, sku, slug, title, status, product_type, price_gross_grosz, requires_shipping, allows_pickup, updated_at'
    )
    .order('sku');

  if (error) {
    console.error('admin products list failed', {
      message: error.message,
      code: error.code,
    });
  }

  const products = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Produkty</h1>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Tytuł</th>
              <th className="px-4 py-2">Typ</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Cena</th>
              <th className="px-4 py-2">Realizacja</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  {error
                    ? 'Nie udało się pobrać produktów.'
                    : 'Brak produktów.'}
                </td>
              </tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              products.map((p: any) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/produkty/${p.id}`}
                      className="underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{p.product_type}</td>
                  <td className="px-4 py-2">{p.status}</td>
                  <td className="px-4 py-2">
                    {formatPrice(p.price_gross_grosz)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {[
                      p.requires_shipping ? 'wysyłka' : null,
                      p.allows_pickup ? 'odbiór' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
