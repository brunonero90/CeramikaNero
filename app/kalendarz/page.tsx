import type { Metadata } from 'next';
import { PublicEventCalendar } from '@/components/calendar/public-event-calendar';
import { getPublicCalendarSessions } from '@/lib/database/services/calendar';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kalendarz warsztatów | Ceramika Nero',
  description:
    'Nadchodzące terminy warsztatów ceramicznych w Pracowni Ceramiki Nero — Suchy Las / Poznań.',
};

export default async function KalendarzPage() {
  const sessions = await getPublicCalendarSessions();
  const cards = sessions.map((s) => ({
    id: s.id,
    workshopTitle: s.workshopTitle,
    workshopSlug: s.workshopSlug,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    timezone: s.timezone,
    capacity: s.capacity,
    reservedCount: s.reservedCount,
    priceGrossGrosz: s.priceGrossGrosz,
    status: s.status,
    locationName: s.locationName,
  }));

  return (
    <div className="bg-surface-bg">
      <header className="mx-auto max-w-5xl px-4 pt-12 pb-2 text-center md:px-6 md:pt-16">
        <h1 className="font-heading text-4xl font-semibold text-text-primary md:text-5xl">
          Kalendarz warsztatów
        </h1>
        <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-text-muted uppercase">
          Terminy w strefie Europe/Warsaw
        </p>
      </header>
      <PublicEventCalendar sessions={cards} />
    </div>
  );
}
