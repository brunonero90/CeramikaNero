import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_reference,
      status,
      payment_status,
      fulfillment_status,
      fulfillment_method,
      total_gross_grosz,
      shipping_quote_required,
      created_at,
      customer_profiles (first_name, last_name, email)
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('admin orders list failed', {
      message: error.message,
      code: error.code,
    });
  }

  const orders = data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Zamówienia</h1>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Numer</th>
              <th className="px-4 py-2">Klient</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Płatność</th>
              <th className="px-4 py-2">Realizacja</th>
              <th className="px-4 py-2">Kwota</th>
              <th className="px-4 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                  {error ? 'Nie udało się pobrać zamówień.' : 'Brak zamówień.'}
                </td>
              </tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              orders.map((order: any) => {
                const profile = order.customer_profiles as {
                  first_name: string | null;
                  last_name: string | null;
                  email: string | null;
                } | null;
                return (
                  <tr key={order.id} className="border-b last:border-b-0">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/zamowienia/${order.id}`}
                        className="font-medium underline"
                      >
                        {order.order_reference}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {profile
                        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
                        : '—'}
                      <br />
                      <span className="text-xs text-gray-500">
                        {profile?.email ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2">{order.status}</td>
                    <td className="px-4 py-2">{order.payment_status}</td>
                    <td className="px-4 py-2">
                      {order.fulfillment_method}
                      {order.shipping_quote_required ? ' · wycena wysyłki' : ''}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(order.total_gross_grosz)}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(order.created_at).toLocaleString('pl-PL')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
