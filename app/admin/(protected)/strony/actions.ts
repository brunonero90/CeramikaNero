'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { pageInputSchema } from '@/lib/admin/schemas';
import { isReservedPageSlug } from '@/lib/utils/reserved-slugs';

export type PageActionState =
  | { ok: true; id?: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

export async function createPageAction(
  _prevState: PageActionState | undefined,
  formData: FormData
): Promise<PageActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const parsed = pageInputSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: formData.get('excerpt') || null,
    content: formData.get('content') || null,
    status: formData.get('status'),
    suggestedTheme: formData.get('suggestedTheme') || null,
    seoTitle: formData.get('seoTitle') || null,
    seoDescription: formData.get('seoDescription') || null,
    publishedAt: formData.get('publishedAt') || null,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  if (isReservedPageSlug(data.slug)) {
    return {
      ok: false,
      errors: { slug: 'Ten slug jest zarezerwowany przez aplikację.' },
    };
  }

  const { data: inserted, error } = await supabase
    .from('content_pages')
    .insert({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      status: data.status,
      suggested_theme: data.suggestedTheme,
      seo_title: data.seoTitle,
      seo_description: data.seoDescription,
      published_at: data.publishedAt,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się utworzyć strony. Sprawdź unikalność slug.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_page',
    entityType: 'page',
    entityId: inserted.id,
    summary: `Created page ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/strony');
  revalidatePath(`/${data.slug}`);
  return { ok: true, id: inserted.id, message: 'Strona została utworzona.' };
}

export async function updatePageAction(
  id: string,
  _prevState: PageActionState | undefined,
  formData: FormData
): Promise<PageActionState> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  const parsed = pageInputSchema.safeParse({
    title: formData.get('title'),
    slug: formData.get('slug'),
    excerpt: formData.get('excerpt') || null,
    content: formData.get('content') || null,
    status: formData.get('status'),
    suggestedTheme: formData.get('suggestedTheme') || null,
    seoTitle: formData.get('seoTitle') || null,
    seoDescription: formData.get('seoDescription') || null,
    publishedAt: formData.get('publishedAt') || null,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  if (isReservedPageSlug(data.slug)) {
    return {
      ok: false,
      errors: { slug: 'Ten slug jest zarezerwowany przez aplikację.' },
    };
  }

  const { error } = await supabase
    .from('content_pages')
    .update({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      status: data.status,
      suggested_theme: data.suggestedTheme,
      seo_title: data.seoTitle,
      seo_description: data.seoDescription,
      published_at: data.publishedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się zaktualizować strony.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_page',
    entityType: 'page',
    entityId: id,
    summary: `Updated page ${data.title}`,
    changedFields: { title: data.title, slug: data.slug, status: data.status },
  });

  revalidatePath('/admin/strony');
  revalidatePath(`/${data.slug}`);
  return { ok: true, message: 'Strona została zaktualizowana.' };
}

export async function archivePageAction(id: string): Promise<void> {
  const admin = await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();

  await supabase
    .from('content_pages')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', id);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'archive_page',
    entityType: 'page',
    entityId: id,
    summary: 'Archived page',
  });

  revalidatePath('/admin/strony');
}
