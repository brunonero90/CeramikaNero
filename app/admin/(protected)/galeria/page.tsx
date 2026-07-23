import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { toggleGalleryItemVisibilityAction } from './actions';

export const metadata = {
  title: 'Galeria | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function GalleryAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['editor', 'manager']);
  const params = await searchParams;
  const supabase = createClient();

  const category = typeof params.category === 'string' ? params.category : '';
  const visible = typeof params.visible === 'string' ? params.visible : '';
  const page = Math.max(1, Number(params.page ?? 1));

  let query = supabase
    .from('gallery_items')
    .select(
      'id, title, description, category, display_order, is_visible, media_asset_id, media_assets(original_filename, storage_path, alt_text)',
      { count: 'exact' }
    );

  if (category) query = query.eq('category', category);
  if (visible === 'true') query = query.eq('is_visible', true);
  if (visible === 'false') query = query.eq('is_visible', false);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: items, count } = await query
    .order('display_order', { ascending: true })
    .range(from, to);

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 0;

  const { data: categories } = await supabase
    .from('gallery_items')
    .select('category')
    .neq('category', null);
  const categorySet = new Set(
    (categories ?? []).map((c) => c.category).filter(Boolean)
  );

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  const buildLink = (patch: Record<string, string>) => {
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    if (visible) next.set('visible', visible);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const qs = next.toString();
    return `/admin/galeria${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Galeria</h1>
        <Link
          href="/admin/galeria/nowy"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Dodaj element
        </Link>
      </div>

      <form method="GET" className="rounded-lg border bg-white p-4">
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="category" className="block text-sm font-medium">
              Kategoria
            </label>
            <select
              id="category"
              name="category"
              defaultValue={category}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              {Array.from(categorySet).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="visible" className="block text-sm font-medium">
              Widoczność
            </label>
            <select
              id="visible"
              name="visible"
              defaultValue={visible}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Wszystkie</option>
              <option value="true">Widoczne</option>
              <option value="false">Ukryte</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
          <Link
            href="/admin/galeria"
            className="rounded-md border px-4 py-2 text-sm"
          >
            Wyczyść
          </Link>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items && items.length > 0 ? (
          items.map((item) => {
            const media = item.media_assets as unknown as {
              original_filename: string;
              storage_path: string;
              alt_text: string;
            };
            return (
              <div key={item.id} className="rounded-lg border bg-white p-3">
                <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-100">
                  <Image
                    src={`${baseUrl}/${media.storage_path}`}
                    alt={media.alt_text}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                </div>
                <p className="mt-2 truncate text-sm font-medium">
                  {item.title ?? media.original_filename}
                </p>
                <p className="text-xs text-gray-500">
                  {item.category ?? 'Bez kategorii'} · Kolejność{' '}
                  {item.display_order}
                </p>
                <p className="text-xs text-gray-500">
                  {item.is_visible ? 'Widoczny' : 'Ukryty'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Link
                    href={`/admin/galeria/${item.id}`}
                    className="text-sm text-gray-900 underline"
                  >
                    Edytuj
                  </Link>
                  <form action={toggleGalleryItemVisibilityAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="isVisible"
                      value={!item.is_visible ? 'on' : ''}
                    />
                    <button
                      type="submit"
                      className="text-sm text-gray-900 underline"
                    >
                      {item.is_visible ? 'Ukryj' : 'Pokaż'}
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        ) : (
          <p className="col-span-full text-center text-gray-500">
            Brak elementów.
          </p>
        )}
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
