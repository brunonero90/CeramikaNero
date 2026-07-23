import { requireOwner } from '@/lib/admin/auth';
import { RedirectForm } from '../redirect-form';
import { createRedirectAction } from '../actions';

export const metadata = {
  title: 'Nowe przekierowanie | Ceramika Nero Admin',
};

export default async function NewRedirectPage() {
  await requireOwner();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nowe przekierowanie</h1>
      <RedirectForm
        action={createRedirectAction}
        submitLabel="Utwórz przekierowanie"
      />
    </div>
  );
}
