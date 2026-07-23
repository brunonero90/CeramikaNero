import { requireAnyRole } from '@/lib/admin/auth';
import { PageForm } from '../page-form';
import { createPageAction } from '../actions';

export const metadata = {
  title: 'Nowa strona | Ceramika Nero Admin',
};

export default async function NewPagePage() {
  await requireAnyRole(['editor', 'manager']);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nowa strona</h1>
      <PageForm action={createPageAction} submitLabel="Utwórz stronę" />
    </div>
  );
}
