'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { blogPostInputSchema } from '@/lib/admin/schemas';
import {
  normaliseSlugInput,
  slugifyTitle,
  isReservedSlug,
} from '@/lib/admin/slugs';

export type BlogPostActionState =
  | { ok: true; id: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

async function validateBlogPostForm(
  supabase: ReturnType<typeof createClient>,
  formData: FormData,
  excludeId?: string
): Promise<
  | { ok: true; data: z.infer<typeof blogPostInputSchema> }
  | { ok: false; errors: Record<string, string>; formError?: string }
> {
  const title = formData.get('title')?.toString() ?? '';
  let slug = normaliseSlugInput(formData.get('slug')?.toString() ?? '');
  if (!slug && title) slug = slugifyTitle(title);

  if (isReservedSlug(slug)) {
    return { ok: false, errors: { slug: 'Ten slug jest zarezerwowany.' } };
  }

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing && existing.id !== excludeId) {
    return { ok: false, errors: { slug: 'Ten slug jest już używany.' } };
  }

  const parsed = blogPostInputSchema.safeParse({
    title,
    slug,
    excerpt: formData.get('excerpt') ?? '',
    content: formData.get('content') ?? '',
    featuredMediaId: formData.get('featuredMediaId') || null,
    status: formData.get('status'),
    authorName: formData.get('authorName') || null,
    publishedAt: formData.get('publishedAt') || null,
    seoTitle: formData.get('seoTitle') || null,
    seoDescription: formData.get('seoDescription') || null,
    legacyWixUrl: formData.get('legacyWixUrl') || null,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  if (data.featuredMediaId) {
    const { data: media } = await supabase
      .from('media_assets')
      .select('id')
      .eq('id', data.featuredMediaId)
      .maybeSingle();
    if (!media) {
      return { ok: false, errors: { featuredMediaId: 'Plik nie istnieje.' } };
    }
  }

  return { ok: true, data };
}

export async function createBlogPostAction(
  _prevState: BlogPostActionState | undefined,
  formData: FormData
): Promise<BlogPostActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const validated = await validateBlogPostForm(supabase, formData);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { data: inserted, error } = await supabase
    .from('blog_posts')
    .insert({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      featured_media_id: data.featuredMediaId,
      status: data.status,
      author_name: data.authorName,
      published_at: data.publishedAt,
      seo_title: data.seoTitle,
      seo_description: data.seoDescription,
      legacy_wix_url: data.legacyWixUrl,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: 'Nie udało się utworzyć wpisu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_blog_post',
    entityType: 'blog_post',
    entityId: inserted.id,
    summary: `Created blog post ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${data.slug}`);
  return { ok: true, id: inserted.id, message: 'Wpis został utworzony.' };
}

export async function updateBlogPostAction(
  id: string,
  _prevState: BlogPostActionState | undefined,
  formData: FormData
): Promise<BlogPostActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('id, slug, status')
    .eq('id', id)
    .single();
  if (!existing) {
    return { ok: false, formError: 'Wpis nie istnieje.', errors: {} };
  }

  const validated = await validateBlogPostForm(supabase, formData, id);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { error } = await supabase
    .from('blog_posts')
    .update({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      featured_media_id: data.featuredMediaId,
      status: data.status,
      author_name: data.authorName,
      published_at: data.publishedAt,
      seo_title: data.seoTitle,
      seo_description: data.seoDescription,
      legacy_wix_url: data.legacyWixUrl,
      archived_at: data.status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zaktualizować wpisu.',
      errors: {},
    };
  }

  if (
    existing.slug !== data.slug &&
    existing.status === 'published' &&
    data.status !== 'archived'
  ) {
    const { data: existingRedirect } = await supabase
      .from('legacy_redirects')
      .select('id')
      .eq('source_path', `/blog/${existing.slug}`)
      .maybeSingle();
    if (!existingRedirect) {
      await supabase.from('legacy_redirects').insert({
        source_path: `/blog/${existing.slug}`,
        destination_path: `/blog/${data.slug}`,
        status_code: 301,
        notes: 'Automatyczne przekierowanie po zmianie slug posta',
      });
    }
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_blog_post',
    entityType: 'blog_post',
    entityId: id,
    summary: `Updated blog post ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  revalidatePath(`/blog/${data.slug}`);
  revalidatePath(`/blog/${existing.slug}`);
  return { ok: true, id, message: 'Wpis został zaktualizowany.' };
}

export async function changeBlogPostStatusAction(
  id: string,
  status: 'draft' | 'published' | 'archived'
): Promise<BlogPostActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const update: {
    status: string;
    archived_at?: string | null;
    published_at?: string | null;
  } = { status };
  if (status === 'archived') {
    update.archived_at = new Date().toISOString();
  } else if (status === 'published') {
    update.archived_at = null;
    update.published_at = new Date().toISOString();
  } else {
    update.archived_at = null;
  }

  const { data: existing } = await supabase
    .from('blog_posts')
    .select('slug')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('blog_posts')
    .update(update)
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zmienić statusu wpisu.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: `blog_post_status_${status}`,
    entityType: 'blog_post',
    entityId: id,
    summary: `Changed blog post status to ${status}`,
    changedFields: { status },
  });

  revalidatePath('/admin/blog');
  revalidatePath('/blog');
  if (existing) {
    revalidatePath(`/blog/${existing.slug}`);
  }
  return { ok: true, id, message: 'Status wpisu został zmieniony.' };
}
