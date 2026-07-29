import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';
import {
  setOrderShippingQuoteAction,
  updateOrderOperationalStateAction,
  setOrderAnalyticsExcludedAction,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      *,
      customer_profiles (first_name, last_name, email, phone),
      order_items (
        id, item_type, title_snapshot, quantity, unit_price_gross_grosz,
        line_total_gross_grosz, fulfillment_method, booking_id, product_id, metadata
      ),
      order_addresses (
        recipient_name, street_line1, street_line2, postal_code, city, country, phone
      )
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (!order) notFound();

  const profile = order.customer_profiles as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;

  const address = Array.isArray(order.order_addresses)
    ? order.order_addresses[0]
    : order.order_addresses;

  const items = (order.order_items ?? []) as Array<{
    id: string;
    item_type: string;
    title_snapshot: string;
    quantity: number;
    line_total_gross_grosz: number;
    fulfillment_method: string | null;
    booking_id: string | null;
  }>;

  const [{ data: bookings }, { data: events }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_reference, status')
      .eq('order_id', id),
    supabase
      .from('order_events')
      .select('id, event_type, actor_type, metadata, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: false })
      .limit(40),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{order.order_reference}</h1>
        <p className="text-sm text-gray-600">
          {order.status} · płatność: {order.payment_status} · realizacja:{' '}
          {order.fulfillment_status} ({order.fulfillment_method})
          {order.analytics_excluded ? ' · wykluczone z analityki' : ''}
        </p>
      </div>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Analityka</h2>
        <p className="mb-3 text-gray-600">
          Wyklucz testowe / treningowe zamówienia z domyślnych KPI (powiązane
          rezerwacje są synchronizowane).
        </p>
        <form action={setOrderAnalyticsExcludedAction} className="space-y-2">
          <input type="hidden" name="orderId" value={order.id} />
          <input
            type="hidden"
            name="excluded"
            value={order.analytics_excluded ? '0' : '1'}
          />
          {!order.analytics_excluded ? (
            <label className="block">
              Powód (opcjonalnie)
              <input
                name="reason"
                className="mt-1 w-full rounded border px-2 py-2"
                maxLength={200}
                placeholder="np. test Stripe"
              />
            </label>
          ) : null}
          <button
            type="submit"
            className="min-h-11 rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            {order.analytics_excluded
              ? 'Przywróć do analityki'
              : 'Wyklucz z analityki'}
          </button>
        </form>
      </section>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Klient</h2>
        {profile ? (
          <p>
            {profile.first_name} {profile.last_name}
            <br />
            {profile.email}
            {profile.phone ? (
              <>
                <br />
                {profile.phone}
              </>
            ) : null}
          </p>
        ) : (
          <p>—</p>
        )}
      </section>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Pozycje</h2>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              {item.title_snapshot} × {item.quantity} —{' '}
              {formatPrice(item.line_total_gross_grosz)}
              {item.fulfillment_method && item.fulfillment_method !== 'none'
                ? ` (${item.fulfillment_method})`
                : ''}
              {item.booking_id ? (
                <>
                  {' '}
                  ·{' '}
                  <Link
                    href={`/admin/rezerwacje/${item.booking_id}`}
                    className="underline"
                  >
                    rezerwacja
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold">
          Suma pozycji: {formatPrice(order.subtotal_gross_grosz)}
        </p>
        <p className="text-sm text-gray-600">
          Wysyłka:{' '}
          {order.shipping_quote_required
            ? 'do potwierdzenia'
            : formatPrice(order.shipping_gross_grosz)}
        </p>
        <p className="mt-1 font-semibold">
          {order.shipping_quote_required
            ? 'Kwota do zapłaty: po potwierdzeniu wysyłki'
            : `Do zapłaty: ${formatPrice(order.total_gross_grosz)}`}
        </p>
      </section>

      {order.shipping_quote_required ? (
        <section className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">
          <h2 className="mb-2 font-semibold">Potwierdź koszt wysyłki</h2>
          <p className="mb-3 text-amber-950">
            Klient nie powinien przelewać środków, dopóki nie ustalisz finalnej
            kwoty z wysyłką.
          </p>
          <form
            action={setOrderShippingQuoteAction}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="orderId" value={order.id} />
            <label className="text-sm">
              Koszt wysyłki (PLN)
              <input
                name="shippingFeePln"
                type="number"
                min="0"
                step="0.01"
                required
                className="mt-1 block w-40 border px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-gray-900 px-4 py-2 text-white"
            >
              Zapisz wycenę
            </button>
          </form>
        </section>
      ) : null}

      {address ? (
        <section className="rounded border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Adres dostawy</h2>
          <p>
            {address.recipient_name}
            <br />
            {address.street_line1}
            {address.street_line2 ? (
              <>
                <br />
                {address.street_line2}
              </>
            ) : null}
            <br />
            {address.postal_code} {address.city}
            <br />
            {address.country}
          </p>
        </section>
      ) : null}

      <form
        action={updateOrderOperationalStateAction}
        className="space-y-3 rounded border bg-white p-4 text-sm"
      >
        <h2 className="font-semibold">Operacje</h2>
        <input type="hidden" name="orderId" value={order.id} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            Status zamówienia
            <select
              name="orderStatus"
              defaultValue={order.status}
              className="mt-1 block w-full border px-2 py-1"
            >
              {[
                'awaiting_payment',
                'confirmed',
                'cancelled',
                'expired',
                'refunded',
                'partially_refunded',
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Płatność
            <select
              name="paymentStatus"
              defaultValue={order.payment_status}
              className="mt-1 block w-full border px-2 py-1"
            >
              {[
                'pending',
                'paid',
                'failed',
                'cancelled',
                'refunded',
                'partially_refunded',
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Realizacja
            <select
              name="fulfillmentStatus"
              defaultValue={order.fulfillment_status}
              className="mt-1 block w-full border px-2 py-1"
            >
              {['unfulfilled', 'partial', 'fulfilled', 'cancelled'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          Numer przesyłki (opcjonalnie)
          <input
            name="trackingReference"
            defaultValue={order.tracking_reference ?? ''}
            className="mt-1 w-full border px-2 py-1"
            placeholder="np. numer listu przewozowego"
          />
        </label>
        <label className="block">
          Notatki wewnętrzne
          <textarea
            name="internalNotes"
            defaultValue={order.internal_notes ?? ''}
            rows={3}
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white"
        >
          Zapisz statusy
        </button>
      </form>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Historia zdarzeń</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-gray-500">Brak zdarzeń.</p>
        ) : (
          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(events ?? []).map((ev: any) => (
              <li key={ev.id} className="border-b pb-2 last:border-0">
                <span className="font-medium">{ev.event_type}</span>
                <span className="text-gray-500">
                  {' '}
                  · {ev.actor_type} ·{' '}
                  {new Date(ev.created_at).toLocaleString('pl-PL')}
                </span>
                {ev.metadata?.by ? (
                  <span className="block text-xs text-gray-600">
                    przez {String(ev.metadata.by)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Powiązane rezerwacje</h2>
        {(bookings ?? []).length === 0 ? (
          <p className="text-gray-500">Brak powiązanych rezerwacji.</p>
        ) : (
          <ul className="space-y-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(bookings ?? []).map((b: any) => (
              <li key={b.id}>
                <Link href={`/admin/rezerwacje/${b.id}`} className="underline">
                  {b.booking_reference}
                </Link>{' '}
                ({b.status})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
