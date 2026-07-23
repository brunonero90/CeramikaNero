import { requireAnyRole } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { ManualBookingForm } from './ManualBookingForm';

export const metadata = {
  title: 'Nowa rezerwacja | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewBookingPage() {
  await requireAnyRole(['owner', 'manager']);
  const supabase = createClient();

  const { data: workshops } = await supabase
    .from('workshops')
    .select(
      'id, title, minimum_age, maximum_age, default_price_gross_grosz, booking_mode, status, archived_at'
    )
    .eq('status', 'published')
    .eq('booking_mode', 'scheduled')
    .is('archived_at', null)
    .order('title', { ascending: true });

  const workshopIds = (workshops ?? []).map((w) => w.id);
  const now = new Date().toISOString();
  const { data: sessions } = await supabase
    .from('workshop_sessions')
    .select(
      'id, workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz, location_name, location_address'
    )
    .in('workshop_id', workshopIds.length > 0 ? workshopIds : [])
    .in('status', ['scheduled', 'sold_out'])
    .gte('starts_at', now)
    .order('starts_at', { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nowa rezerwacja</h1>
      <ManualBookingForm
        workshops={workshops ?? []}
        sessions={sessions ?? []}
      />
    </div>
  );
}
