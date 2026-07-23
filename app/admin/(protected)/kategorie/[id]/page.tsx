import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { CategoryForm } from '../category-form';
import { updateCategoryAction } from '../actions';
import { themeSchema } from '@/lib/database/schema';

export const metadata = {
  title: 'Edycja kategorii | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(['manager']);
  const { id } = await params;
  const supabase = createClient();
  const { data: category } = await supabase
    .from('workshop_categories')
    .select(
      'id, name, slug, description, suggested_theme, display_order, is_visible'
    )
    .eq('id', id)
    .single();

  if (!category) {
    notFound();
  }

  const boundAction = updateCategoryAction.bind(null, id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edycja kategorii</h1>
      <CategoryForm
        action={boundAction}
        submitLabel="Zapisz zmiany"
        initialData={{
          name: category.name,
          slug: category.slug,
          description: category.description,
          suggestedTheme: themeSchema.parse(category.suggested_theme),
          displayOrder: category.display_order,
          isVisible: category.is_visible,
        }}
      />
    </div>
  );
}
