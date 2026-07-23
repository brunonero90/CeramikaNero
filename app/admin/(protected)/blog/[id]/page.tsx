import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapBlogPost, mapMediaAsset } from '@/lib/database/mappers';
import { BlogPostForm } from '../blog-form';
import { updateBlogPostAction } from '../actions';

export const metadata = {
  title: 'Edytuj wpis | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .single();
  if (!post) notFound();

  const { data: mediaAssets } = await supabase
    .from('media_assets')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  const mapped = mapBlogPost(post);
  const initialData = {
    ...mapped,
    authorName: mapped.authorName ?? '',
    publishedAt: mapped.publishedAt ?? '',
    seoTitle: mapped.seoTitle ?? '',
    seoDescription: mapped.seoDescription ?? '',
    legacyWixUrl: mapped.legacyWixUrl ?? '',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edytuj wpis</h1>
      <BlogPostForm
        action={updateBlogPostAction.bind(null, id)}
        initialData={initialData}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Zapisz zmiany"
      />
    </div>
  );
}
