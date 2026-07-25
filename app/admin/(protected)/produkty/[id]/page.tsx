import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{product.title}</h1>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">SKU</dt>
          <dd>{product.sku}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Slug</dt>
          <dd>{product.slug}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Status</dt>
          <dd>{product.status}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Typ</dt>
          <dd>{product.product_type}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Cena</dt>
          <dd>{formatPrice(product.price_gross_grosz)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">Wysyłka</dt>
          <dd>
            {product.requires_shipping
              ? `tak (${product.shipping_fee_mode})`
              : 'nie'}
          </dd>
        </div>
      </dl>
      <p className="whitespace-pre-wrap text-sm text-gray-700">
        {product.description}
      </p>
      <p className="text-xs text-gray-500">
        Edycja pełna przez migracje / przyszły formularz admin — dane są już w
        bazie i widoczne w koszyku.
      </p>
    </div>
  );
}
