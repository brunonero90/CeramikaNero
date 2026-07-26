'use server';

import { revalidatePath } from 'next/cache';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';
import { dispatchPendingOrderEmails } from '@/lib/cart/order-email-dispatch';
import { dispatchPendingBookingEmails } from '@/lib/booking/email-dispatch';

export async function retryOrderEmailAction(formData: FormData): Promise<void> {
  await requireAnyRole(['owner', 'manager']);
  const id = String(formData.get('emailId') ?? '');
  if (!id) throw new Error('Brak identyfikatora e-maila.');

  const supabase = createCartAdminClient();
  await supabase
    .from('order_emails')
    .update({
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .neq('status', 'sent');

  await dispatchPendingOrderEmails(5);
  revalidatePath('/admin/emaile');
}

export async function retryBookingEmailAction(
  formData: FormData
): Promise<void> {
  await requireAnyRole(['owner', 'manager']);
  const id = String(formData.get('emailId') ?? '');
  if (!id) throw new Error('Brak identyfikatora e-maila.');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await import('@/lib/supabase/server').then((m) =>
    m.createClient()
  )) as any;

  await supabase
    .from('booking_emails')
    .update({
      status: 'pending',
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .neq('status', 'sent');

  await dispatchPendingBookingEmails(5);
  revalidatePath('/admin/emaile');
}
