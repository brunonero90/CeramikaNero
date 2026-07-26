import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isResendConfigured } from '@/lib/booking/local-mode';
import {
  retryBookingEmailAction,
  retryOrderEmailAction,
} from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminEmailsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const resendOk = isResendConfigured();

  const [{ data: bookingEmails }, { data: orderEmails, error: orderErr }] =
    await Promise.all([
      supabase
        .from('booking_emails')
        .select(
          'id, booking_id, email_type, status, attempt_count, error_message, created_at, updated_at'
        )
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('order_emails')
        .select(
          'id, order_id, email_type, recipient, status, attempt_count, error_message, created_at, updated_at'
        )
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: false })
        .limit(40),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">E-maile / outbox</h1>
        <p className="mt-1 text-sm text-gray-600">
          Resend:{' '}
          {resendOk
            ? 'skonfigurowany'
            : 'brak konfiguracji — wiadomości pozostają w ledgerze'}
        </p>
      </div>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Zamówienia (order_emails)</h2>
        {orderErr ? (
          <p className="text-sm text-amber-800">
            Nie udało się odczytać order_emails (czy migracja 11/13 jest
            zastosowana?).
          </p>
        ) : (orderEmails ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Brak oczekujących / błędnych.</p>
        ) : (
          <ul className="divide-y text-sm">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(orderEmails ?? []).map((row: any) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-2"
              >
                <div>
                  <span className="font-medium">{row.email_type}</span> ·{' '}
                  {row.status} · próby {row.attempt_count ?? 0}
                  <br />
                  <Link
                    href={`/admin/zamowienia/${row.order_id}`}
                    className="underline"
                  >
                    zamówienie
                  </Link>
                  {row.error_message ? (
                    <span className="block text-xs text-red-700">
                      {String(row.error_message).slice(0, 180)}
                    </span>
                  ) : null}
                </div>
                <form action={retryOrderEmailAction}>
                  <input type="hidden" name="emailId" value={row.id} />
                  <button
                    type="submit"
                    className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    Ponów
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Rezerwacje (booking_emails)</h2>
        {(bookingEmails ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Brak oczekujących / błędnych.</p>
        ) : (
          <ul className="divide-y text-sm">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(bookingEmails ?? []).map((row: any) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 py-2"
              >
                <div>
                  <span className="font-medium">{row.email_type}</span> ·{' '}
                  {row.status} · próby {row.attempt_count ?? 0}
                  <br />
                  <Link
                    href={`/admin/rezerwacje/${row.booking_id}`}
                    className="underline"
                  >
                    rezerwacja
                  </Link>
                  {row.error_message ? (
                    <span className="block text-xs text-red-700">
                      {String(row.error_message).slice(0, 180)}
                    </span>
                  ) : null}
                </div>
                <form action={retryBookingEmailAction}>
                  <input type="hidden" name="emailId" value={row.id} />
                  <button
                    type="submit"
                    className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                  >
                    Ponów
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
