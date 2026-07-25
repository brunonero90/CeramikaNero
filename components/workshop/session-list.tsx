import Link from 'next/link';
import { formatGroszAsPln } from '@/lib/utils/money';
import type { WorkshopSession } from '@/lib/database/types';

function formatSessionDateTime(startsAt: string, timezone: string): string {
  const date = new Date(startsAt);
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(date);
}

export function SessionList({
  sessions,
  workshopSlug,
}: {
  sessions: WorkshopSession[];
  workshopSlug?: string;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-text-muted">
        Brak zaplanowanych terminów. Skontaktuj się z nami, by dowiedzieć się o
        najbliższych terminach.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sessions.map((session) => {
        const free = session.capacity - session.reservedCount;
        const soldOut = session.status === 'sold_out' || free <= 0;
        return (
          <li
            key={session.id}
            className="flex flex-col gap-2 rounded-md bg-surface-raised p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-text-primary">
                {formatSessionDateTime(session.startsAt, session.timezone)}
              </p>
              <p className="text-sm text-text-muted">
                {session.locationName}
                {session.locationAddress && `, ${session.locationAddress}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-text-muted">
                {soldOut
                  ? 'Brak wolnych miejsc'
                  : `Wolne miejsca: ${free} / ${session.capacity}`}
              </span>
              {session.priceGrossGrosz > 0 && (
                <span className="font-medium text-text-primary">
                  {formatGroszAsPln(session.priceGrossGrosz)}
                </span>
              )}
              {workshopSlug && !soldOut ? (
                <Link
                  href={`/warsztaty/${workshopSlug}/rezerwacja?session=${encodeURIComponent(session.id)}`}
                  className="inline-flex bg-accent-primary px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
                >
                  Zarezerwuj
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
