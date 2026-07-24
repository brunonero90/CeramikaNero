import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { PageForm } from '../page-form';
import { updatePageAction } from '../actions';
import { contentStatusSchema, themeSchema } from '@/lib/database/schema';

export const metadata = {
  title: 'Edycja strony | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditPagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(['editor', 'manager']);
  const { id } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase
    .from('content_pages')
    .select(
      'id, title, slug, excerpt, content, status, suggested_theme, seo_title, seo_description, published_at'
    )
    .eq('id', id)
    .single();

  if (!page) {
    notFound();
  }

  const boundAction = updatePageAction.bind(null, id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edycja strony</h1>
      <PageForm
        action={boundAction}
        submitLabel="Zapisz zmiany"
        initialData={{
          title: page.title,
          slug: page.slug,
          excerpt: page.excerpt,
          content: page.content,
          status: contentStatusSchema.parse(page.status),
          suggestedTheme: page.suggested_theme
            ? themeSchema.parse(page.suggested_theme)
            : null,
          seoTitle: page.seo_title,
          seoDescription: page.seo_description,
          publishedAt: page.published_at,
        }}
      />
    </div>
  );
}
