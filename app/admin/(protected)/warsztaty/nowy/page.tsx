import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import {
  mapCategory,
  mapInstructor,
  mapMediaAsset,
} from '@/lib/database/mappers';
import { WorkshopForm } from '../workshop-form';
import { createWorkshopAction } from '../actions';

export const metadata = {
  title: 'Nowy warsztat | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewWorkshopPage() {
  await requireAnyRole(['manager']);
  const supabase = await createClient();

  const [{ data: categories }, { data: instructors }, { data: mediaAssets }] =
    await Promise.all([
      supabase.from('workshop_categories').select('*').order('display_order'),
      supabase
        .from('instructors')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('media_assets')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
    ]);

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nowy warsztat</h1>
      <WorkshopForm
        action={createWorkshopAction}
        categories={(categories ?? []).map(mapCategory)}
        instructors={(instructors ?? []).map(mapInstructor)}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Utwórz warsztat"
      />
    </div>
  );
}
