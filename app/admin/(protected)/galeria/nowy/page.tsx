import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapMediaAsset } from '@/lib/database/mappers';
import { GalleryItemForm } from '../gallery-form';
import { createGalleryItemAction } from '../actions';

export const metadata = {
  title: 'Nowy element galerii | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewGalleryItemPage() {
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: mediaAssets } = await supabase
    .from('media_assets')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nowy element galerii</h1>
      <GalleryItemForm
        action={createGalleryItemAction}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Dodaj do galerii"
      />
    </div>
  );
}
