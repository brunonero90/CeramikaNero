'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { recordAuditEvent } from '@/lib/admin/audit';
import { redirectInputSchema } from '@/lib/admin/schemas';
import { detectRedirectLoop } from '@/lib/admin/redirects';
import { mapLegacyRedirect } from '@/lib/database/mappers';

export type RedirectActionState =
  | { ok: true; id?: string; message: string }
  | { ok: false; errors: Record<string, string>; formError?: string };

export async function createRedirectAction(
  _prevState: RedirectActionState | undefined,
  formData: FormData
): Promise<RedirectActionState> {
  const admin = await requireOwner();
  const supabase = await createClient();

  const parsed = redirectInputSchema.safeParse({
    sourcePath: formData.get('sourcePath'),
    destinationPath: formData.get('destinationPath'),
    statusCode: Number(formData.get('statusCode')),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  const { data: existing } = await supabase
    .from('legacy_redirects')
    .select(
      'id, source_path, destination_path, status_code, notes, created_at, updated_at'
    );

  if (
    detectRedirectLoop(
      (existing ?? []).map(mapLegacyRedirect),
      data.sourcePath,
      data.destinationPath
    )
  ) {
    return {
      ok: false,
      errors: { destinationPath: 'Wykryto pętlę lub łańcuch przekierowań.' },
    };
  }

  const { data: inserted, error } = await supabase
    .from('legacy_redirects')
    .insert({
      source_path: data.sourcePath,
      destination_path: data.destinationPath,
      status_code: data.statusCode,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się utworzyć przekierowania.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'create_redirect',
    entityType: 'redirect',
    entityId: inserted.id,
    summary: `Created redirect ${data.sourcePath} -> ${data.destinationPath}`,
    changedFields: {
      source_path: data.sourcePath,
      destination_path: data.destinationPath,
      status_code: data.statusCode,
    },
  });

  revalidatePath('/admin/przekierowania');
  return {
    ok: true,
    id: inserted.id,
    message: 'Przekierowanie zostało utworzone.',
  };
}

export async function updateRedirectAction(
  id: string,
  _prevState: RedirectActionState | undefined,
  formData: FormData
): Promise<RedirectActionState> {
  const admin = await requireOwner();
  const supabase = await createClient();

  const parsed = redirectInputSchema.safeParse({
    sourcePath: formData.get('sourcePath'),
    destinationPath: formData.get('destinationPath'),
    statusCode: Number(formData.get('statusCode')),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      errors[issue.path.join('.')] = issue.message;
    });
    return { ok: false, errors };
  }

  const data = parsed.data;
  const { data: existing } = await supabase
    .from('legacy_redirects')
    .select(
      'id, source_path, destination_path, status_code, notes, created_at, updated_at'
    )
    .neq('id', id);

  if (
    detectRedirectLoop(
      (existing ?? []).map(mapLegacyRedirect),
      data.sourcePath,
      data.destinationPath
    )
  ) {
    return {
      ok: false,
      errors: { destinationPath: 'Wykryto pętlę lub łańcuch przekierowań.' },
    };
  }

  const { error } = await supabase
    .from('legacy_redirects')
    .update({
      source_path: data.sourcePath,
      destination_path: data.destinationPath,
      status_code: data.statusCode,
    })
    .eq('id', id);

  if (error) {
    return {
      ok: false,
      errors: {},
      formError: 'Nie udało się zaktualizować przekierowania.',
    };
  }

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'update_redirect',
    entityType: 'redirect',
    entityId: id,
    summary: `Updated redirect ${data.sourcePath} -> ${data.destinationPath}`,
    changedFields: {
      source_path: data.sourcePath,
      destination_path: data.destinationPath,
      status_code: data.statusCode,
    },
  });

  revalidatePath('/admin/przekierowania');
  return { ok: true, message: 'Przekierowanie zostało zaktualizowane.' };
}

export async function deleteRedirectAction(id: string): Promise<void> {
  const admin = await requireOwner();
  const supabase = await createClient();

  await supabase.from('legacy_redirects').delete().eq('id', id);

  await recordAuditEvent(supabase, {
    actorUserId: admin.userId,
    actorRole: admin.role,
    action: 'delete_redirect',
    entityType: 'redirect',
    entityId: id,
    summary: 'Deleted redirect',
  });

  revalidatePath('/admin/przekierowania');
}
