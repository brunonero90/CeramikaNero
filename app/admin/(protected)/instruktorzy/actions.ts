'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { instructorInputSchema } from '@/lib/admin/schemas';
import {
  normaliseSlugInput,
  slugifyTitle,
  isReservedSlug,
} from '@/lib/admin/slugs';

export type InstructorActionState =
  | { ok: true; id: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

async function validateInstructorForm(
  supabase: ReturnType<typeof createClient>,
  formData: FormData,
  excludeId?: string
): Promise<
  | { ok: true; data: z.infer<typeof instructorInputSchema> }
  | { ok: false; errors: Record<string, string>; formError?: string }
> {
  const displayName = formData.get('displayName')?.toString() ?? '';
  let slug = normaliseSlugInput(formData.get('slug')?.toString() ?? '');
  if (!slug && displayName) slug = slugifyTitle(displayName);

  if (isReservedSlug(slug)) {
    return { ok: false, errors: { slug: 'Ten slug jest zarezerwowany.' } };
  }

  const { data: existing } = await supabase
    .from('instructors')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing && existing.id !== excludeId) {
    return { ok: false, errors: { slug: 'Ten slug jest już używany.' } };
  }

  const parsed = instructorInputSchema.safeParse({
    displayName,
    slug,
    biography: formData.get('biography') || null,
    profileMediaId: formData.get('profileMediaId') || null,
    isActive: formData.get('isActive') === 'on',
    displayOrder: Number(formData.get('displayOrder') || 0),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;

  if (data.profileMediaId) {
    const { data: media } = await supabase
      .from('media_assets')
      .select('id')
      .eq('id', data.profileMediaId)
      .maybeSingle();
    if (!media) {
      return { ok: false, errors: { profileMediaId: 'Plik nie istnieje.' } };
    }
  }

  return { ok: true, data };
}

export async function createInstructorAction(
  _prevState: InstructorActionState | undefined,
  formData: FormData
): Promise<InstructorActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const validated = await validateInstructorForm(supabase, formData);
  if (!validated.ok) return validated;
  const data = validated.data;

  const { data: inserted, error } = await supabase
    .from('instructors')
    .insert({
      display_name: data.displayName,
      slug: data.slug,
      biography: data.biography,
      profile_media_id: data.profileMediaId,
      is_active: data.isActive,
      display_order: data.displayOrder,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      formError: 'Nie udało się utworzyć instruktora.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_instructor',
    entityType: 'instructor',
    entityId: inserted.id,
    summary: `Created instructor ${data.displayName}`,
    changedFields: { display_name: data.displayName, slug: data.slug },
  });

  revalidatePath('/admin/instruktorzy');
  revalidatePath('/warsztaty');
  return { ok: true, id: inserted.id, message: 'Instruktor został utworzony.' };
}

export async function updateInstructorAction(
  id: string,
  _prevState: InstructorActionState | undefined,
  formData: FormData
): Promise<InstructorActionState> {
  const admin = await requireAnyRole(['manager']);
  const supabase = createClient();

  const { data: existing } = await supabase
    .from('instructors')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) {
    return { ok: false, formError: 'Instruktor nie istnieje.', errors: {} };
  }

  const validated = await validateInstructorForm(supabase, formData, id);
  if (!validated.ok) return validated;
  const data = validated.data;

  let warning = '';
  if (!data.isActive) {
    const { data: futureSessions } = await supabase
      .from('workshop_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('instructor_id', id)
      .gt('starts_at', new Date().toISOString());
    if ((futureSessions?.length ?? 0) > 0) {
      warning = ' Uwaga: instruktor ma przypisane przyszłe terminy.';
    }
  }

  const { error } = await supabase
    .from('instructors')
    .update({
      display_name: data.displayName,
      slug: data.slug,
      biography: data.biography,
      profile_media_id: data.profileMediaId,
      is_active: data.isActive,
      display_order: data.displayOrder,
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      formError: 'Nie udało się zaktualizować instruktora.',
      errors: {},
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_instructor',
    entityType: 'instructor',
    entityId: id,
    summary: `Updated instructor ${data.displayName}`,
    changedFields: { display_name: data.displayName, is_active: data.isActive },
  });

  revalidatePath('/admin/instruktorzy');
  revalidatePath('/warsztaty');
  return {
    ok: true,
    id,
    message: `Instruktor został zaktualizowany.${warning}`,
  };
}
