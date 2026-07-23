import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapMediaAsset } from '@/lib/database/mappers';
import { InstructorForm } from '../instructor-form';
import { createInstructorAction } from '../actions';

export const metadata = {
  title: 'Nowy instruktor | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewInstructorPage() {
  await requireAnyRole(['manager']);
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
      <h1 className="text-2xl font-semibold">Nowy instruktor</h1>
      <InstructorForm
        action={createInstructorAction}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Utwórz instruktora"
      />
    </div>
  );
}
