import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';

export const metadata = {
  title: 'Pulpit | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

type WorkshopTitleRel = { title: string } | { title: string }[] | null;

type UpcomingSessionRow = {
  id: string;
  starts_at: string;
  timezone: string | null;
  capacity: number;
  reserved_count: number;
  workshops: WorkshopTitleRel;
};

type RecentBookingRow = {
  id: string;
  booking_reference: string;
  status: string;
  total_price_gross_grosz: number;
};

type QuoteOrderRow = {
  id: string;
  order_reference: string;
  created_at: string;
};

export default async function AdminDashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const now = new Date().toISOString();

  const [
    { count: upcomingSessions },
    { count: awaitingBookings },
    { count: quoteOrders },
    { count: newOrders },
    { data: upcomingSessionsList },
    { data: recentBookings },
    { data: quoteOrdersList },
  ] = await Promise.all([
    supabase
      .from('workshop_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['scheduled', 'sold_out'])
      .gt('starts_at', now),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'awaiting_payment'),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('shipping_quote_required', true)
      .neq('status', 'cancelled'),
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'awaiting_payment'),
    supabase
      .from('workshop_sessions')
      .select(
        'id, starts_at, timezone, capacity, reserved_count, workshops(title)'
      )
      .in('status', ['scheduled', 'sold_out'])
      .gt('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(6),
    supabase
      .from('bookings')
      .select(
        'id, booking_reference, status, total_price_gross_grosz, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('orders')
      .select('id, order_reference, total_gross_grosz, created_at')
      .eq('shipping_quote_required', true)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const sessions = (upcomingSessionsList ?? []) as UpcomingSessionRow[];
  const bookings = (recentBookings ?? []) as RecentBookingRow[];
  const quotes = (quoteOrdersList ?? []) as QuoteOrderRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pulpit</h1>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/admin/terminy/nowy"
            className="rounded border px-3 py-2 hover:bg-gray-50"
          >
            Nowy termin
          </Link>
          <Link
            href="/admin/rezerwacje"
            className="rounded border px-3 py-2 hover:bg-gray-50"
          >
            Rezerwacje
          </Link>
          <Link
            href="/admin/zamowienia"
            className="rounded border px-3 py-2 hover:bg-gray-50"
          >
            Zamówienia
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Nadchodzące terminy"
          value={upcomingSessions ?? 0}
        />
        <SummaryCard
          label="Rezerwacje oczekujące na płatność"
          value={awaitingBookings ?? 0}
        />
        <SummaryCard
          label="Zamówienia do wyceny wysyłki"
          value={quoteOrders ?? 0}
        />
        <SummaryCard label="Zamówienia oczekujące" value={newOrders ?? 0} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-medium">Nadchodzące terminy</h2>
          {sessions.length ? (
            <ul className="divide-y text-sm">
              {sessions.map((session) => {
                const title = Array.isArray(session.workshops)
                  ? session.workshops[0]?.title
                  : session.workshops?.title;
                const free = session.capacity - session.reserved_count;
                return (
                  <li key={session.id} className="py-2">
                    <Link
                      href={`/admin/terminy/${session.id}`}
                      className="font-medium underline"
                    >
                      {title ?? 'Warsztat'}
                    </Link>
                    <br />
                    <span className="text-gray-500">
                      {new Date(session.starts_at).toLocaleString('pl-PL', {
                        timeZone: session.timezone || 'Europe/Warsaw',
                      })}{' '}
                      · wolne {free}/{session.capacity}
                      {free <= 3 && free > 0 ? ' · mało miejsc' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Brak nadchodzących terminów.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-medium">Ostatnie rezerwacje</h2>
          {bookings.length ? (
            <ul className="divide-y text-sm">
              {bookings.map((b) => (
                <li key={b.id} className="py-2">
                  <Link
                    href={`/admin/rezerwacje/${b.id}`}
                    className="font-medium underline"
                  >
                    {b.booking_reference}
                  </Link>{' '}
                  · {b.status} · {formatPrice(b.total_price_gross_grosz)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Brak rezerwacji.</p>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4 lg:col-span-2">
          <h2 className="mb-3 text-lg font-medium">
            Zamówienia wymagające wyceny wysyłki
          </h2>
          {quotes.length ? (
            <ul className="divide-y text-sm">
              {quotes.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <Link
                    href={`/admin/zamowienia/${o.id}`}
                    className="font-medium underline"
                  >
                    {o.order_reference}
                  </Link>
                  <span className="text-gray-500">
                    {new Date(o.created_at).toLocaleString('pl-PL')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Brak zamówień oczekujących na wycenę wysyłki.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}
