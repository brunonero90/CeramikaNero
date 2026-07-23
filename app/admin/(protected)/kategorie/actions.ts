'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { categoryInputSchema } from '@/lib/admin/schemas';

export type CategoryActionState =
  | { ok: true; id?: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

export async function createCategoryAction(
  _prevState: CategoryActionState | undefined,
  formData: FormData
): Promise<CategoryActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const parsed = categoryInputSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') || null,
    suggestedTheme: formData.get('suggestedTheme'),
    displayOrder: Number(formData.get('displayOrder') || 0),
    isVisible: formData.get('isVisible') === 'on',
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  const { data: inserted, error } = await supabase
    .from('workshop_categories')
    .insert({
      name: data.name,
      slug: data.slug,
      description: data.description,
      suggested_theme: data.suggestedTheme,
      display_order: data.displayOrder,
      is_visible: data.isVisible,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się utworzyć kategorii. Sprawdź unikalność slug.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_category',
    entityType: 'category',
    entityId: inserted.id,
    summary: `Created category ${data.name}`,
    changedFields: { name: data.name, slug: data.slug },
  });

  revalidatePath('/admin/kategorie');
  revalidatePath('/');
  return { ok: true, id: inserted.id, message: 'Kategoria została utworzona.' };
}

export async function updateCategoryAction(
  id: string,
  _prevState: CategoryActionState | undefined,
  formData: FormData
): Promise<CategoryActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const parsed = categoryInputSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description') || null,
    suggestedTheme: formData.get('suggestedTheme'),
    displayOrder: Number(formData.get('displayOrder') || 0),
    isVisible: formData.get('isVisible') === 'on',
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      const path = issue.path.join('.');
      errors[path] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  const { error } = await supabase
    .from('workshop_categories')
    .update({
      name: data.name,
      slug: data.slug,
      description: data.description,
      suggested_theme: data.suggestedTheme,
      display_order: data.displayOrder,
      is_visible: data.isVisible,
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się zaktualizować kategorii.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_category',
    entityType: 'category',
    entityId: id,
    summary: `Updated category ${data.name}`,
    changedFields: { name: data.name, slug: data.slug },
  });

  revalidatePath('/admin/kategorie');
  revalidatePath('/');
  return { ok: true, message: 'Kategoria została zaktualizowana.' };
}

export async function archiveCategoryAction(id: string): Promise<void> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const { data: usage } = await supabase
    .from('workshops')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);

  const hasWorkshops = (usage?.length ?? 0) > 0 || false;
  if (hasWorkshops) {
    throw new Error('Kategoria zawiera warsztaty i nie może zostać usunięta.');
  }

  await supabase
    .from('workshop_categories')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'archive_category',
    entityType: 'category',
    entityId: id,
    summary: 'Archived category',
  });

  revalidatePath('/admin/kategorie');
  revalidatePath('/');
}
