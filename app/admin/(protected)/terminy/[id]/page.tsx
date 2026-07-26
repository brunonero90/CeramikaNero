import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import {
  mapInstructor,
  mapWorkshop,
  mapWorkshopSession,
} from '@/lib/database/mappers';
import { groszToZloty } from '@/lib/utils/money';
import { utcToLocalDateTime } from '@/lib/admin/timezones';
import { SessionForm } from '../session-form';
import { updateSessionAction } from '../actions';
import { SessionOps } from './session-ops';

export const metadata = {
  title: 'Edytuj termin | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('workshop_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (!session) notFound();

  const mapped = mapWorkshopSession(session);
  const start = utcToLocalDateTime(new Date(mapped.startsAt));
  const end = utcToLocalDateTime(new Date(mapped.endsAt));
  const bookingOpens = mapped.bookingOpensAt
    ? utcToLocalDateTime(new Date(mapped.bookingOpensAt))
    : null;
  const bookingCloses = mapped.bookingClosesAt
    ? utcToLocalDateTime(new Date(mapped.bookingClosesAt))
    : null;

  const [{ data: workshops }, { data: instructors }] = await Promise.all([
    supabase
      .from('workshops')
      .select('*')
      .neq('status', 'archived')
      .is('archived_at', null)
      .order('title'),
    supabase
      .from('instructors')
      .select('*')
      .eq('is_active', true)
      .order('display_order'),
  ]);

  const initialData = {
    ...mapped,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    capacity: mapped.capacity,
    priceGrossPln: Number(groszToZloty(mapped.priceGrossGrosz)),
    venueKey: mapped.venueKey ?? 'suchy-las',
    locationName: mapped.locationName ?? '',
    locationAddress: mapped.locationAddress ?? '',
    bookingOpensDate: bookingOpens?.date ?? '',
    bookingOpensTime: bookingOpens?.time ?? '',
    bookingClosesDate: bookingCloses?.date ?? '',
    bookingClosesTime: bookingCloses?.time ?? '',
    externalBookingUrl: mapped.externalBookingUrl ?? '',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edytuj termin</h1>
      <SessionOps sessionId={id} />
      <SessionForm
        action={updateSessionAction.bind(null, id)}
        initialData={initialData}
        workshops={(workshops ?? []).map(mapWorkshop)}
        instructors={(instructors ?? []).map(mapInstructor)}
        submitLabel="Zapisz zmiany"
      />
    </div>
  );
}
