import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAnyRole } from '@/lib/admin/auth';
import { loadSessionCockpit } from '@/lib/admin/session-cockpit';
import type { RosterBooking } from '@/lib/admin/session-roster';
import {
  humanAttendance,
  humanPaymentStatus,
} from '@/lib/admin/session-roster';
import { formatWarsawDateTime } from '@/lib/utils/datetime';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Druk listy | Ceramika Nero Admin',
  robots: { index: false, follow: false },
};

function PrintGroup({
  title,
  bookings,
}: {
  title: string;
  bookings: RosterBooking[];
}) {
  if (!bookings.length) return null;
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="border-b pb-1 text-base font-semibold">{title}</h2>
      <ul className="mt-3 space-y-4">
        {bookings.map((b) => (
          <li key={b.bookingId} className="break-inside-avoid text-sm">
            <p className="font-medium">
              {b.purchaserName}{' '}
              <span className="font-normal text-gray-600">
                ({b.bookingReference}
                {b.orderReference ? ` / ${b.orderReference}` : ''})
              </span>
            </p>
            <p>
              {b.purchaserPhone ?? '—'} · {b.purchaserEmail ?? '—'} ·{' '}
              {humanPaymentStatus(b.paymentStatus)}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {b.participants.map((p) => (
                <li key={p.id}>
                  {p.displayName || '—'}
                  {p.age != null ? `, ${p.age} lat` : ''} —{' '}
                  {humanAttendance(p.attendanceStatus)}
                  {p.accessibilityNotes ? ` · ${p.accessibilityNotes}` : ''}
                </li>
              ))}
            </ul>
            {b.customerNotes ? <p>Klient: {b.customerNotes}</p> : null}
            {b.internalNotes ? <p>Wewn.: {b.internalNotes}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function PrintRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(['owner', 'manager']);
  const { id } = await params;
  const cockpit = await loadSessionCockpit(id);
  if (!cockpit) notFound();

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-gray-900 print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          a { text-decoration: none; color: black; }
          .no-print { display: none !important; }
        }
      `}</style>
      <p className="no-print mb-4 text-sm">
        <Link href={`/admin/terminy/${id}`} className="underline">
          Wróć
        </Link>
        {' · '}
        Użyj Ctrl/Cmd+P, aby wydrukować.
      </p>
      <h1 className="text-2xl font-semibold">{cockpit.workshopTitle}</h1>
      <p className="mt-1 text-sm">
        {formatWarsawDateTime(cockpit.startsAt)}
        {cockpit.locationName ? ` · ${cockpit.locationName}` : ''}
        {cockpit.locationAddress ? `, ${cockpit.locationAddress}` : ''}
      </p>
      <p className="mt-1 text-sm">
        Pojemność {cockpit.capacity} · zarezerwowane {cockpit.reservedCount} ·
        obecni {cockpit.checkedInCount}
      </p>

      <PrintGroup title="Aktywne / gotowi" bookings={cockpit.ready} />
      <PrintGroup title="Wymaga uwagi" bookings={cockpit.attention} />
      <PrintGroup
        title="Usunięte (anulowane / wygasłe / zwrócone)"
        bookings={cockpit.removed}
      />
    </main>
  );
}
