import { requireAnyRole } from '@/lib/admin/auth';
import { CategoryForm } from '../category-form';
import { createCategoryAction } from '../actions';

export const metadata = {
  title: 'Nowa kategoria | Ceramika Nero Admin',
};

export default async function NewCategoryPage() {
  await requireAnyRole(['manager']);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nowa kategoria</h1>
      <CategoryForm
        action={createCategoryAction}
        submitLabel="Utwórz kategorię"
      />
    </div>
  );
}
