import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { RedirectForm } from '../redirect-form';
import { updateRedirectAction } from '../actions';

export const metadata = {
  title: 'Edycja przekierowania | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const supabase = createClient();
  const { data: redirect } = await supabase
    .from('legacy_redirects')
    .select('id, source_path, destination_path, status_code')
    .eq('id', id)
    .single();

  if (!redirect) {
    notFound();
  }

  const boundAction = updateRedirectAction.bind(null, id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edycja przekierowania</h1>
      <RedirectForm
        action={boundAction}
        submitLabel="Zapisz zmiany"
        initialData={{
          sourcePath: redirect.source_path,
          destinationPath: redirect.destination_path,
          statusCode: redirect.status_code as 301 | 308,
        }}
      />
    </div>
  );
}
