import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';
import { updateProductAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!product) notFound();

  const pricePln = (Number(product.price_gross_grosz) / 100).toFixed(2);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/produkty" className="text-sm underline">
          ← Produkty
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.title}</h1>
        <p className="text-sm text-gray-600">
          Aktualnie: {formatPrice(product.price_gross_grosz)} ·{' '}
          {product.product_type}
        </p>
      </div>

      <form
        action={updateProductAction}
        className="space-y-4 rounded border bg-white p-4"
      >
        <input type="hidden" name="id" value={product.id} />
        <label className="block text-sm">
          Tytuł
          <input
            name="title"
            required
            defaultValue={product.title}
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Slug
            <input
              name="slug"
              required
              defaultValue={product.slug}
              className="mt-1 w-full border px-2 py-1 font-mono text-xs"
            />
          </label>
          <label className="block text-sm">
            SKU
            <input
              name="sku"
              required
              defaultValue={product.sku}
              className="mt-1 w-full border px-2 py-1 font-mono text-xs"
            />
          </label>
        </div>
        <label className="block text-sm">
          Krótki opis
          <textarea
            name="shortDescription"
            rows={2}
            defaultValue={product.short_description ?? ''}
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          Opis
          <textarea
            name="description"
            rows={6}
            defaultValue={product.description ?? ''}
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Status
            <select
              name="status"
              defaultValue={product.status}
              className="mt-1 w-full border px-2 py-1"
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="block text-sm">
            Cena brutto (PLN)
            <input
              name="priceGrossPln"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={pricePln}
              className="mt-1 w-full border px-2 py-1"
            />
          </label>
        </div>
        <label className="block text-sm">
          Tryb wysyłki
          <select
            name="shippingFeeMode"
            defaultValue={product.shipping_fee_mode}
            className="mt-1 w-full border px-2 py-1"
          >
            <option value="quote_required">quote_required</option>
            <option value="fixed">fixed</option>
            <option value="free">free</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="requiresShipping"
              defaultChecked={product.requires_shipping}
            />
            Wysyłka dostępna
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="allowsPickup"
              defaultChecked={product.allows_pickup}
            />
            Odbiór w pracowni
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="trackInventory"
              defaultChecked={product.track_inventory}
            />
            Śledź magazyn
          </label>
        </div>
        <label className="block text-sm">
          Stan magazynowy
          <input
            name="inventoryQuantity"
            type="number"
            min="0"
            defaultValue={product.inventory_quantity}
            className="mt-1 w-40 border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Zapisz produkt
        </button>
      </form>
    </div>
  );
}
