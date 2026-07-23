import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapMediaAsset } from '@/lib/database/mappers';
import { BlogPostForm } from '../blog-form';
import { createBlogPostAction } from '../actions';

export const metadata = {
  title: 'Nowy wpis | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewBlogPostPage() {
  await requireAnyRole(['editor', 'manager']);
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
      <h1 className="text-2xl font-semibold">Nowy wpis</h1>
      <BlogPostForm
        action={createBlogPostAction}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Utwórz wpis"
      />
    </div>
  );
}
