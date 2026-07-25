import { redirect } from 'next/navigation';
import { formatPrice } from '@/lib/utils/price';
import {
  isBookingLocalMode,
  LOCAL_BOOKING_BANNER,
} from '@/lib/booking/local-mode';
import {
  cancelLocalSessionAction,
  createLocalSessionAction,
  loadLocalAdminData,
  localAdminLogoutAction,
  updateLocalBookingStatusAction,
} from '../actions';

export const dynamic = 'force-dynamic';

function formatWarsaw(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default async function LocalAdminDashboardPage() {
  // Production builds keep BOOKING_LOCAL_MODE off — never throw during prerender.
  if (!isBookingLocalMode()) {
    redirect('/admin/local?error=disabled');
  }

  const { sessions, bookings, outbox, workshops } = await loadLocalAdminData();

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {LOCAL_BOOKING_BANNER}
          </p>
          <h1 className="text-3xl font-semibold">
            Lokalny panel — sesje i rezerwacje
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Dane w <code>tmp/local-booking/store.json</code>. Formularze
            strukturalne — bez edycji JSON.
          </p>
        </div>
        <form action={localAdminLogoutAction}>
          <button
            type="submit"
            className="rounded border px-4 py-2 text-sm font-medium"
          >
            Wyloguj
          </button>
        </form>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Utwórz sesję [TEST]</h2>
        <form
          action={createLocalSessionAction}
          className="grid gap-3 rounded border p-4 md:grid-cols-2"
        >
          <label className="text-sm md:col-span-2">
            Warsztat
            <select
              name="workshopSlug"
              required
              className="mt-1 w-full rounded border px-3 py-2"
              defaultValue="ceramika-dla-doroslych"
            >
              {workshops
                .filter((w) => w.status === 'published')
                .map((w) => (
                  <option key={w.id} value={w.slug}>
                    {w.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            Start (czas lokalny przeglądarki → zapis UTC)
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Czas trwania (min)
            <input
              type="number"
              name="durationMinutes"
              min={30}
              defaultValue={150}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Pojemność
            <input
              type="number"
              name="capacity"
              min={1}
              defaultValue={8}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Cena (grosze)
            <input
              type="number"
              name="priceGrossGrosz"
              min={0}
              defaultValue={18000}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="published" defaultChecked />
            Opublikuj natychmiast (widoczne w kalendarzu publicznym)
          </label>
          <button
            type="submit"
            className="rounded bg-accent-primary px-5 py-3 text-sm font-semibold text-white uppercase md:col-span-2 md:w-fit"
          >
            Zapisz sesję
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sesje ({sessions.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Termin</th>
                <th className="py-2 pr-3">Warsztat</th>
                <th className="py-2 pr-3">Miejsca</th>
                <th className="py-2 pr-3">Cena</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-surface-subtle/40">
                  <td className="py-3 pr-3 align-top">
                    {formatWarsaw(s.startsAt)}
                  </td>
                  <td className="py-3 pr-3 align-top">{s.workshopTitle}</td>
                  <td className="py-3 pr-3 align-top">
                    {s.reservedCount}/{s.capacity}
                  </td>
                  <td className="py-3 pr-3 align-top">
                    {formatPrice(s.priceGrossGrosz)}
                  </td>
                  <td className="py-3 pr-3 align-top">
                    {s.status}
                    {!s.published ? ' · draft' : ''}
                  </td>
                  <td className="py-3 align-top">
                    {s.status !== 'cancelled' ? (
                      <form action={cancelLocalSessionAction}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <button
                          type="submit"
                          className="text-sm font-medium text-red-700 underline"
                        >
                          Anuluj
                        </button>
                      </form>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Rezerwacje ({bookings.length})
        </h2>
        <ul className="space-y-4">
          {bookings.length === 0 ? (
            <li className="text-sm text-text-muted">Brak rezerwacji.</li>
          ) : (
            bookings.map((b) => (
              <li key={b.id} className="rounded border p-4 text-sm">
                <p className="font-semibold">{b.bookingReference}</p>
                <p className="mt-1">
                  {b.purchaserFirstName} {b.purchaserLastName} ·{' '}
                  {b.purchaserEmail} · {b.purchaserPhone}
                </p>
                <p className="mt-1">
                  Status: <strong>{b.status}</strong> · Miejsca: {b.quantity} ·{' '}
                  {formatPrice(b.totalPriceGrossGrosz)}
                </p>
                <p className="mt-1 text-text-muted">
                  Sesja: {b.sessionId} · zgoda RODO v{b.privacyPolicyVersion} ·{' '}
                  {formatWarsaw(b.createdAt)}
                </p>
                {b.status !== 'cancelled' ? (
                  <form
                    action={updateLocalBookingStatusAction}
                    className="mt-3"
                  >
                    <input type="hidden" name="bookingId" value={b.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <input
                      type="hidden"
                      name="reason"
                      value="Anulowanie przez lokalnego admina"
                    />
                    <button
                      type="submit"
                      className="text-sm font-medium text-red-700 underline"
                    >
                      Anuluj rezerwację (zwolnij miejsca)
                    </button>
                  </form>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          Outbox e-mail ({outbox.length})
        </h2>
        <ul className="space-y-3">
          {outbox.length === 0 ? (
            <li className="text-sm text-text-muted">Brak wiadomości.</li>
          ) : (
            outbox.slice(0, 20).map((mail) => (
              <li key={mail.id} className="rounded border p-3 text-sm">
                <p className="font-medium">
                  {mail.type} → {mail.to}
                </p>
                <p>{mail.subject}</p>
                <p className="mt-1 text-text-muted">
                  {mail.status} · {formatWarsaw(mail.createdAt)} ·{' '}
                  {mail.providerMessageId}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}
