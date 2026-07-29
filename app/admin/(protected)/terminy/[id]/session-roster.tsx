'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { RosterBooking, SessionCockpit } from '@/lib/admin/session-roster';
import {
  humanAttendance,
  humanAttentionReason,
  humanPaymentStatus,
} from '@/lib/admin/session-roster';
import {
  completeAttendanceReviewAction,
  markRemainingNoShowsAction,
  setAttendanceAction,
} from '../attendance-actions';

function BookingCard({
  booking,
  sessionId,
  sessionStarted,
}: {
  booking: RosterBooking;
  sessionId: string;
  sessionStarted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setStatus(
    participantId: string,
    status: 'checked_in' | 'no_show' | 'excused' | 'expected'
  ) {
    startTransition(async () => {
      await setAttendanceAction({ participantId, sessionId, status });
      router.refresh();
    });
  }

  return (
    <article className="rounded-md border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{booking.purchaserName}</p>
          <p className="text-xs text-gray-500">
            {booking.bookingReference}
            {booking.orderReference ? ` · ${booking.orderReference}` : ''}
          </p>
        </div>
        <Link
          href={`/admin/rezerwacje/${booking.bookingId}`}
          className="text-sm text-gray-700 underline"
        >
          Szczegóły
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {booking.purchaserPhone ? (
          <a className="underline" href={`tel:${booking.purchaserPhone}`}>
            {booking.purchaserPhone}
          </a>
        ) : (
          <span className="text-amber-700">Brak telefonu</span>
        )}
        {booking.purchaserEmail ? (
          <a className="underline" href={`mailto:${booking.purchaserEmail}`}>
            {booking.purchaserEmail}
          </a>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">Płatność</dt>
          <dd>
            {booking.paymentMethod ?? '—'} ·{' '}
            {humanPaymentStatus(booking.paymentStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Źródło</dt>
          <dd>{booking.source ?? '—'}</dd>
        </div>
      </dl>

      {booking.attentionReasons.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {booking.attentionReasons.map((r) => (
            <li
              key={r}
              className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
            >
              {humanAttentionReason(r)}
            </li>
          ))}
        </ul>
      ) : null}

      {booking.customerNotes ? (
        <p className="mt-2 text-sm text-gray-700">
          <span className="font-medium">Klient: </span>
          {booking.customerNotes}
        </p>
      ) : null}
      {booking.internalNotes ? (
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium">Wewnętrzne: </span>
          {booking.internalNotes}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {booking.participants.map((p) => (
          <li key={p.id} className="rounded border border-gray-100 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {p.displayName?.trim() || (
                  <span className="text-amber-700">Brak imienia</span>
                )}
                {p.age != null ? (
                  <span className="ml-2 text-sm text-gray-500">{p.age} lat</span>
                ) : null}
              </p>
              <span className="text-sm text-gray-600">
                {humanAttendance(p.attendanceStatus)}
              </span>
            </div>
            {p.accessibilityNotes ? (
              <p className="mt-1 text-sm text-gray-700">
                Org./dostępność: {p.accessibilityNotes}
              </p>
            ) : null}
            {sessionStarted || booking.bucket !== 'removed' ? (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setStatus(p.id, 'checked_in')}
                  className="min-h-11 rounded-md bg-emerald-700 px-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Obecny
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setStatus(p.id, 'no_show')}
                  className="min-h-11 rounded-md bg-rose-700 px-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Nieobecny
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setStatus(p.id, 'excused')}
                  className="min-h-11 rounded-md bg-slate-600 px-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Usprawiedliwiony
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setStatus(p.id, 'expected')}
                  className="min-h-11 rounded-md border px-2 text-sm font-medium disabled:opacity-50"
                >
                  Cofnij
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Section({
  title,
  bookings,
  sessionId,
  sessionStarted,
  empty,
}: {
  title: string;
  bookings: RosterBooking[];
  sessionId: string;
  sessionStarted: boolean;
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900">
        {title}{' '}
        <span className="text-sm font-normal text-gray-500">
          ({bookings.length})
        </span>
      </h3>
      {bookings.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => (
            <BookingCard
              key={b.bookingId}
              booking={b}
              sessionId={sessionId}
              sessionStarted={sessionStarted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function SessionRosterPanel({ cockpit }: { cockpit: SessionCockpit }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const sessionStarted = new Date(cockpit.startsAt) <= new Date();

  return (
    <div className="space-y-6 rounded-md border bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Lista obecności</h2>
          <p className="mt-1 text-sm text-gray-600">
            {cockpit.reservedCount}/{cockpit.capacity} miejsc · obecni{' '}
            {cockpit.checkedInCount} · nieobecni {cockpit.absentCount}
          </p>
          {cockpit.warnings.map((w) => (
            <p key={w} className="mt-1 text-sm text-amber-800">
              ⚠ {w}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/terminy/${cockpit.sessionId}/druk`}
            className="inline-flex min-h-11 items-center rounded-md border bg-white px-3 text-sm"
          >
            Drukuj
          </Link>
          <a
            href={`/admin/terminy/${cockpit.sessionId}/roster.csv`}
            className="inline-flex min-h-11 items-center rounded-md border bg-white px-3 text-sm"
          >
            CSV
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!sessionStarted || pending}
          onClick={() => {
            if (
              !confirm(
                'Oznaczyć wszystkich pozostałych oczekiwanych uczestników jako nieobecnych?'
              )
            ) {
              return;
            }
            startTransition(async () => {
              await markRemainingNoShowsAction({
                sessionId: cockpit.sessionId,
              });
              router.refresh();
            });
          }}
          className="min-h-11 rounded-md border border-rose-300 bg-white px-3 text-sm text-rose-800 disabled:opacity-40"
        >
          Oznacz pozostałych jako nieobecnych
        </button>
        <button
          type="button"
          disabled={pending || Boolean(cockpit.attendanceReviewedAt)}
          onClick={() => {
            startTransition(async () => {
              await completeAttendanceReviewAction({
                sessionId: cockpit.sessionId,
              });
              router.refresh();
            });
          }}
          className="min-h-11 rounded-md bg-gray-900 px-3 text-sm text-white disabled:opacity-40"
        >
          {cockpit.attendanceReviewedAt
            ? 'Frekwencja zamknięta'
            : 'Zakończ przegląd frekwencji'}
        </button>
      </div>

      <Section
        title="Gotowi"
        bookings={cockpit.ready}
        sessionId={cockpit.sessionId}
        sessionStarted={sessionStarted}
        empty="Brak potwierdzonych i opłaconych rezerwacji."
      />
      <Section
        title="Wymaga uwagi"
        bookings={cockpit.attention}
        sessionId={cockpit.sessionId}
        sessionStarted={sessionStarted}
        empty="Brak pozycji wymagających uwagi."
      />
      <Section
        title="Usunięte"
        bookings={cockpit.removed}
        sessionId={cockpit.sessionId}
        sessionStarted={sessionStarted}
        empty="Brak anulowanych / wygasłych / zwróconych."
      />
    </div>
  );
}
