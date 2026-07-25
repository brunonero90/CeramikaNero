'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatGroszAsPln } from '@/lib/utils/money';
import { cn } from '@/lib/utils/cn';

export type CalendarSessionCard = {
  id: string;
  workshopTitle: string;
  workshopSlug: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: number;
  reservedCount: number;
  priceGrossGrosz: number;
  status: string;
  locationName: string | null;
};

function dayKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function formatDayHeading(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

function monthMatrix(year: number, monthIndex: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push(key);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function PublicEventCalendar({
  sessions,
  compact = false,
}: {
  sessions: CalendarSessionCard[];
  /** Homepage / fidelity: month grid only, no dual-column agenda explosion. */
  compact?: boolean;
}) {
  const timeZone = sessions[0]?.timezone || 'Europe/Warsaw';
  const todayKey = dayKey(new Date().toISOString(), timeZone);

  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y!, monthIndex: m! - 1 };
  });
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarSessionCard[]>();
    for (const session of sessions) {
      const key = dayKey(session.startsAt, session.timezone || timeZone);
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return map;
  }, [sessions, timeZone]);

  const rows = monthMatrix(cursor.year, cursor.monthIndex);
  const monthLabel = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(cursor.year, cursor.monthIndex, 1)));

  const selected = byDay.get(selectedDay) ?? [];
  const upcoming = sessions.slice(0, 8);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.monthIndex + delta, 1));
      return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
    });
  }

  return (
    <div
      className={cn(
        'mx-auto gap-10 px-4 py-8 md:px-6',
        compact
          ? 'max-w-3xl'
          : 'grid max-w-5xl py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'
      )}
    >
      <section aria-label="Kalendarz warsztatów">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-2xl font-semibold text-text-primary capitalize">
            {monthLabel}
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="border border-surface-subtle px-3 py-2 text-sm font-semibold uppercase"
              aria-label="Poprzedni miesiąc"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="border border-surface-subtle px-3 py-2 text-sm font-semibold uppercase"
              aria-label="Następny miesiąc"
            >
              →
            </button>
          </div>
        </div>

        <div className={cn('mt-4', compact ? 'block' : 'hidden md:block')}>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold tracking-wide text-text-muted uppercase">
            {['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {rows.flat().map((day, idx) => {
              if (!day)
                return (
                  <div
                    key={`e-${idx}`}
                    className={compact ? 'min-h-10' : 'min-h-14'}
                  />
                );
              const has = (byDay.get(day)?.length ?? 0) > 0;
              const isSelected = day === selectedDay;
              const isToday = day === todayKey;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'relative border border-transparent p-1.5 text-sm transition-base',
                    compact ? 'min-h-10' : 'min-h-14 p-2',
                    isSelected && 'border-accent-primary bg-[#f8ebe3]',
                    !isSelected && has && 'bg-surface-raised',
                    isToday && 'font-bold text-accent-primary'
                  )}
                  aria-pressed={isSelected}
                  aria-label={`${day}${has ? ', są warsztaty' : ''}`}
                >
                  {Number(day.slice(-2))}
                  {has ? (
                    <span
                      className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-accent-primary"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {!compact ? (
          <div className="mt-4 md:hidden">
            <label className="block text-sm font-medium text-text-muted">
              Wybierz dzień
              <input
                type="date"
                className="mt-1 w-full border border-surface-subtle bg-surface-bg px-3 py-2"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className={cn('mt-6', compact && 'mt-4')}>
          <h3 className="font-heading text-lg font-semibold text-text-primary md:text-xl">
            {formatDayHeading(selectedDay)}
          </h3>
          {selected.length === 0 ? (
            <p className="mt-3 text-sm text-text-muted">
              {compact
                ? 'Brak dostępnych terminów w tym dniu'
                : 'Brak zaplanowanych warsztatów w tym dniu.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {selected.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {!compact ? (
        <section aria-label="Nadchodzące warsztaty">
          <h2 className="font-heading text-2xl font-semibold text-text-primary">
            Nadchodzące
          </h2>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">
              Nie ma jeszcze opublikowanych terminów. Zobacz ofertę warsztatów
              lub napisz do nas.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {upcoming.map((session) => (
                <SessionCard key={`up-${session.id}`} session={session} />
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/warsztaty"
              className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase"
            >
              Wszystkie warsztaty
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex border border-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-accent-primary uppercase"
            >
              Zapytaj o termin
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SessionCard({ session }: { session: CalendarSessionCard }) {
  const free = session.capacity - session.reservedCount;
  const soldOut = session.status === 'sold_out' || free <= 0;
  const bookHref = `/warsztaty/${session.workshopSlug}/rezerwacja?session=${session.id}`;
  const detailHref = `/termin/${session.id}`;

  return (
    <li className="border border-surface-subtle/50 bg-surface-raised p-4">
      <p className="text-xs font-semibold tracking-wide text-accent-primary uppercase">
        {formatTime(session.startsAt, session.timezone)} ·{' '}
        {session.locationName || 'Pracownia'}
      </p>
      <h3 className="mt-1 font-heading text-lg font-semibold text-text-primary">
        <Link href={detailHref} className="hover:underline">
          {session.workshopTitle}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-text-muted">
        {soldOut
          ? 'Brak wolnych miejsc'
          : `Wolne miejsca: ${free} / ${session.capacity}`}
        {session.priceGrossGrosz > 0
          ? ` · ${formatGroszAsPln(session.priceGrossGrosz)}`
          : ''}
      </p>
      <div className="mt-3">
        {soldOut ? (
          <Link
            href="/kontakt"
            className="text-sm font-semibold text-accent-primary underline-offset-2 hover:underline"
          >
            Zapytaj o listę rezerwową
          </Link>
        ) : (
          <Link
            href={bookHref}
            className="inline-flex bg-accent-primary px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase"
          >
            Zarezerwuj
          </Link>
        )}
      </div>
    </li>
  );
}
