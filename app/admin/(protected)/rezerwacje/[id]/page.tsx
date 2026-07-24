import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAnyRole } from '@/lib/admin/auth';
import {
  getBookingDetailAction,
  getBookingEventsAction,
  getBookingEmailsAction,
} from '../actions';
import { BookingDetailActions } from './BookingDetailActions';
import { formatPrice } from '@/lib/utils/price';
import { formatWarsawDateTime } from '@/lib/utils/datetime';
import type { DbPayment } from '@/lib/database/types';

export const metadata = {
  title: 'Szczegóły rezerwacji | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAnyRole(['owner', 'manager']);
  const { id } = await params;

  let booking: Awaited<ReturnType<typeof getBookingDetailAction>>;
  try {
    booking = await getBookingDetailAction(id);
  } catch {
    notFound();
  }

  const [events, emails] = await Promise.all([
    getBookingEventsAction(id),
    getBookingEmailsAction(id),
  ]);

  const profile = booking.customer_profiles as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    marketing_consent: boolean;
    marketing_consent_at: string | null;
    privacy_policy_version: string;
  };
  const session = booking.workshop_sessions as unknown as {
    id: string;
    starts_at: string;
    ends_at: string;
    timezone: string;
    capacity: number;
    reserved_count: number;
    location_name: string | null;
    location_address: string | null;
    workshops: { id: string; title: string; slug: string };
  };
  const participants = booking.booking_participants as {
    id: string;
    display_name: string | null;
    age: number | null;
    participant_type: string;
    accessibility_notes: string | null;
  }[];
  const payments = (booking.payments as DbPayment[] | null) ?? [];
  const payment = payments[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/rezerwacje"
            className="text-sm text-gray-600 underline"
          >
            ← Rezerwacje
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            Rezerwacja {booking.booking_reference}
          </h1>
        </div>
        <BookingDetailActions
          bookingId={id}
          bookingStatus={booking.status}
          paymentStatus={payment?.status}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Status</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Status rezerwacji</dt>
              <dd className="font-medium">{booking.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Status płatności</dt>
              <dd className="font-medium">{payment?.status ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Źródło</dt>
              <dd className="font-medium">{booking.source}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Utworzona</dt>
              <dd className="font-medium">
                {new Date(booking.created_at).toLocaleString('pl-PL')}
              </dd>
            </div>
            {booking.expires_at && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Wygasa</dt>
                <dd className="font-medium">
                  {new Date(booking.expires_at).toLocaleString('pl-PL')}
                </dd>
              </div>
            )}
            {booking.confirmed_at && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Potwierdzona</dt>
                <dd className="font-medium">
                  {new Date(booking.confirmed_at).toLocaleString('pl-PL')}
                </dd>
              </div>
            )}
            {booking.cancelled_at && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Anulowana</dt>
                <dd className="font-medium">
                  {new Date(booking.cancelled_at).toLocaleString('pl-PL')}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Kupujący</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Imię i nazwisko</dt>
              <dd className="font-medium">
                {profile.first_name} {profile.last_name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">E-mail</dt>
              <dd className="font-medium">{profile.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Telefon</dt>
              <dd className="font-medium">{profile.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Zgoda marketingowa</dt>
              <dd className="font-medium">
                {profile.marketing_consent ? 'Tak' : 'Nie'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Wersja polityki</dt>
              <dd className="font-medium">{profile.privacy_policy_version}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Warsztat i termin</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Warsztat</dt>
              <dd className="font-medium">{session.workshops.title}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Termin</dt>
              <dd className="font-medium">
                {formatWarsawDateTime(session.starts_at)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Strefa czasowa</dt>
              <dd className="font-medium">{session.timezone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Miejsce</dt>
              <dd className="font-medium">
                {[session.location_name, session.location_address]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Dostępność</dt>
              <dd className="font-medium">
                {session.reserved_count} / {session.capacity} zarezerwowanych
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Płatność</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Kwota</dt>
              <dd className="font-medium">
                {formatPrice(booking.total_price_gross_grosz)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Dostawca</dt>
              <dd className="font-medium">{payment?.provider ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Zwrócono</dt>
              <dd className="font-medium">
                {payment ? formatPrice(payment.refunded_amount_grosz) : '—'}
              </dd>
            </div>
            {payment?.provider_checkout_id && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Stripe Checkout</dt>
                <dd className="font-medium truncate max-w-[200px]">
                  {payment.provider_checkout_id}
                </dd>
              </div>
            )}
            {payment?.provider_payment_id && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Stripe PaymentIntent</dt>
                <dd className="font-medium truncate max-w-[200px]">
                  {payment.provider_payment_id}
                </dd>
              </div>
            )}
          </dl>
        </section>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Uczestnicy</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-3 py-2">Imię</th>
              <th className="px-3 py-2">Wiek</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Uwagi</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0">
                <td className="px-3 py-2">{p.display_name ?? '—'}</td>
                <td className="px-3 py-2">{p.age ?? '—'}</td>
                <td className="px-3 py-2">{p.participant_type}</td>
                <td className="px-3 py-2">{p.accessibility_notes ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">Historia operacyjna</h2>
        <ul className="space-y-2 text-sm">
          {events.length === 0 && (
            <li className="text-gray-500">Brak wpisów.</li>
          )}
          {events.map((e) => (
            <li key={e.id} className="flex justify-between">
              <span>
                {e.event_type} · {e.actor_type}
              </span>
              <span className="text-gray-500">
                {new Date(e.created_at).toLocaleString('pl-PL')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 font-semibold">E-maile</h2>
        <ul className="space-y-2 text-sm">
          {emails.length === 0 && (
            <li className="text-gray-500">Brak e-maili.</li>
          )}
          {emails.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span>
                {m.email_type} · {m.status}
              </span>
              <span className="text-gray-500">
                {m.sent_at ? new Date(m.sent_at).toLocaleString('pl-PL') : '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
