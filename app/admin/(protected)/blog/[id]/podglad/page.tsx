import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';

export const metadata = {
  title: 'Podgląd wpisu | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function BlogPostPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('id', id)
    .single();
  if (!post) notFound();

  redirect(`/blog/${post.slug}`);
}
