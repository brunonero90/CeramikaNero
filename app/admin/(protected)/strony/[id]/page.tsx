import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { PageForm } from '../page-form';
import { updatePageAction } from '../actions';

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
  const supabase = createClient();
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
          status: page.status,
          suggestedTheme: page.suggested_theme,
          seoTitle: page.seo_title,
          seoDescription: page.seo_description,
          publishedAt: page.published_at,
        }}
      />
    </div>
  );
}
