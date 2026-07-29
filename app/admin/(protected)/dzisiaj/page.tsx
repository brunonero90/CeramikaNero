import Link from 'next/link';
import { requireAnyRole } from '@/lib/admin/auth';
import { loadTodaysSessions } from '@/lib/admin/session-cockpit';
import { formatWarsawDateTime } from '@/lib/utils/datetime';

export const metadata = {
  title: 'Dzisiaj | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TodayOpsPage() {
  await requireAnyRole(['manager']);
  const sessions = await loadTodaysSessions();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dzisiaj</h1>
          <p className="mt-1 text-sm text-gray-600">
            Terminy w strefie Europe/Warsaw — szybki dostęp do list obecności.
          </p>
        </div>
        <Link
          href="/admin/terminy"
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Wszystkie terminy
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-md border bg-white p-6 text-sm text-gray-600">
          Brak zaplanowanych warsztatów na dziś.
        </p>
      ) : (
        <ul className="grid gap-3">
          {sessions.map((s) => (
            <li
              key={s.sessionId}
              className="rounded-md border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {s.workshopTitle}
                  </h2>
                  <p className="mt-1 text-sm text-gray-700">
                    {formatWarsawDateTime(s.startsAt)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {[s.locationName, s.locationAddress]
                      .filter(Boolean)
                      .join(' · ') || 'Lokalizacja do uzupełnienia'}
                  </p>
                  {s.instructorName ? (
                    <p className="mt-1 text-sm text-gray-600">
                      Instruktor: {s.instructorName}
                    </p>
                  ) : null}
                </div>
                <Link
                  href={`/admin/terminy/${s.sessionId}`}
                  className="inline-flex min-h-11 items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Lista obecności
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-gray-500">Miejsca</dt>
                  <dd className="font-medium">
                    {s.reservedCount}/{s.capacity} (wolne {s.placesRemaining})
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Opłacone / potwierdzone</dt>
                  <dd className="font-medium">{s.confirmedPaidSeats}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Obecni</dt>
                  <dd className="font-medium">{s.checkedInCount}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Nieobecni</dt>
                  <dd className="font-medium">{s.absentCount}</dd>
                </div>
              </dl>
              {s.warnings.length > 0 ? (
                <ul className="mt-3 space-y-1 text-sm text-amber-800">
                  {s.warnings.map((w) => (
                    <li key={w}>⚠ {w}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
