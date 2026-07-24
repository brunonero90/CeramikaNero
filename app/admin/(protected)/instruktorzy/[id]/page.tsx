import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapInstructor, mapMediaAsset } from '@/lib/database/mappers';
import { InstructorForm } from '../instructor-form';
import { updateInstructorAction } from '../actions';

export const metadata = {
  title: 'Edytuj instruktora | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditInstructorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: instructor } = await supabase
    .from('instructors')
    .select('*')
    .eq('id', id)
    .single();
  if (!instructor) notFound();

  const { data: mediaAssets } = await supabase
    .from('media_assets')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  const mapped = mapInstructor(instructor);
  const initialData = {
    ...mapped,
    biography: mapped.biography ?? '',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edytuj instruktora</h1>
      <InstructorForm
        action={updateInstructorAction.bind(null, id)}
        initialData={initialData}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Zapisz zmiany"
      />
    </div>
  );
}
