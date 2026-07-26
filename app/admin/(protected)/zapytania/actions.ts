'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';

const STATUSES = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
  'archived',
] as const;

export async function updateEnquiryAction(formData: FormData): Promise<void> {
  const admin = await requireAnyRole(['owner', 'manager']);
  const id = String(formData.get('enquiryId') ?? '');
  const status = String(formData.get('status') ?? '');
  const notes = String(formData.get('internalNotes') ?? '');

  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    throw new Error('Nieprawidłowe dane zapytania.');
  }

  const supabase = createCartAdminClient();
  const { error } = await supabase
    .from('enquiries')
    .update({
      status,
      internal_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('enquiry update failed', error.message);
    throw new Error('Nie udało się zaktualizować zapytania.');
  }

  await supabase.from('enquiry_events').insert({
    enquiry_id: id,
    event_type: 'status_updated',
    actor_type: 'admin',
    actor_id: admin.userId,
    metadata: {
      status,
      by: admin.displayName,
    },
  });

  revalidatePath('/admin/zapytania');
  revalidatePath(`/admin/zapytania/${id}`);
  redirect(`/admin/zapytania/${id}`);
}
