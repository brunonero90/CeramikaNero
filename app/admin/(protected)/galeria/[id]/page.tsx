import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapGalleryItem, mapMediaAsset } from '@/lib/database/mappers';
import { GalleryItemForm } from '../gallery-form';
import { updateGalleryItemAction } from '../actions';

export const metadata = {
  title: 'Edytuj element galerii | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditGalleryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: item } = await supabase
    .from('gallery_items')
    .select('*')
    .eq('id', id)
    .single();
  if (!item) notFound();

  const { data: mediaAssets } = await supabase
    .from('media_assets')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  const mapped = mapGalleryItem(item);
  const initialData = {
    ...mapped,
    title: mapped.title ?? '',
    description: mapped.description ?? '',
    category: mapped.category ?? '',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edytuj element galerii</h1>
      <GalleryItemForm
        action={updateGalleryItemAction.bind(null, id)}
        initialData={initialData}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Zapisz zmiany"
      />
    </div>
  );
}
