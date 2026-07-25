import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { deliverBookingEmail } from '@/lib/booking/email-transport';
import { formatPrice } from '@/lib/utils/price';

async function markOrderEmail(
  id: string,
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  const supabase = createCartAdminClient();
  await supabase
    .from('order_emails')
    .update({
      status,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
      attempt_count: 1,
    })
    .eq('id', id);
}

export async function notifyOrderCreated(orderId: string): Promise<void> {
  const supabase = createCartAdminClient();
  const { data: order } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_reference,
      total_gross_grosz,
      shipping_quote_required,
      fulfillment_method,
      customer_profiles (email, first_name, last_name),
      order_items (
        item_type, title_snapshot, quantity, unit_price_gross_grosz,
        line_total_gross_grosz, fulfillment_method, metadata, booking_id
      ),
      order_addresses (
        recipient_name, street_line1, street_line2, postal_code, city, country
      ),
      order_emails (id, email_type, recipient, status)
    `
    )
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return;

  const profile = order.customer_profiles as {
    email: string;
    first_name: string;
    last_name: string;
  } | null;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_reference')
    .filter('order_id', 'eq', orderId);

  const bookingRefs = (
    (bookings ?? []) as Array<{ booking_reference: string }>
  ).map((b) => b.booking_reference);
  const items = (order.order_items ?? []) as Array<{
    item_type: string;
    title_snapshot: string;
    quantity: number;
    line_total_gross_grosz: number;
    fulfillment_method: string | null;
  }>;

  const address = Array.isArray(order.order_addresses)
    ? order.order_addresses[0]
    : order.order_addresses;

  const linesText = items
    .map(
      (i) =>
        `• ${i.title_snapshot} × ${i.quantity} — ${formatPrice(i.line_total_gross_grosz)}` +
        (i.fulfillment_method && i.fulfillment_method !== 'none'
          ? ` (${i.fulfillment_method === 'shipping' ? 'wysyłka' : 'odbiór'})`
          : '')
    )
    .join('\n');

  const addressText =
    address && typeof address === 'object'
      ? `\nAdres dostawy:\n${address.recipient_name}\n${address.street_line1}${
          address.street_line2 ? `\n${address.street_line2}` : ''
        }\n${address.postal_code} ${address.city}\n${address.country}`
      : '';

  const shippingNote = order.shipping_quote_required
    ? '\n\nKoszt wysyłki zostanie potwierdzony osobno przed płatnością końcową.'
    : '';

  const body = [
    `Dziękujemy za zamówienie ${order.order_reference}.`,
    bookingRefs.length
      ? `Numery rezerwacji warsztatów: ${bookingRefs.join(', ')}.`
      : null,
    '',
    'Pozycje:',
    linesText,
    '',
    `Suma (produkty/warsztaty): ${formatPrice(order.total_gross_grosz)}.`,
    shippingNote.trim() || null,
    addressText.trim() || null,
    '',
    'Płatność: przelew bankowy — szczegóły prześlemy / potwierdzimy po weryfikacji zamówienia. Stripe nie jest aktywowany.',
    '',
    'Kontakt: https://ceramikanero.netlify.app/kontakt',
    'Regulamin: https://ceramikanero.netlify.app/regulamin',
    'Polityka prywatności: https://ceramikanero.netlify.app/polityka-prywatnosci',
  ]
    .filter((x) => x !== null)
    .join('\n');

  const emails = (order.order_emails ?? []) as Array<{
    id: string;
    email_type: string;
    recipient: string;
    status: string;
  }>;

  for (const row of emails) {
    if (row.status === 'sent') continue;
    const subject =
      row.email_type === 'admin_notification'
        ? `[Ceramika Nero] Nowe zamówienie ${order.order_reference}`
        : `Potwierdzenie zamówienia ${order.order_reference} — Ceramika Nero`;
    const to =
      row.email_type === 'admin_notification'
        ? row.recipient
        : (profile?.email ?? row.recipient);
    const html = `<pre style="font-family:sans-serif;white-space:pre-wrap">${body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</pre>`;
    try {
      const delivered = await deliverBookingEmail({
        bookingId: orderId,
        type: row.email_type,
        to,
        subject,
        html,
        text: body,
      });
      if (delivered.ok) {
        await markOrderEmail(row.id, 'sent');
      } else {
        await markOrderEmail(
          row.id,
          'failed',
          delivered.errorMessage ?? 'delivery failed'
        );
      }
    } catch (err) {
      await markOrderEmail(
        row.id,
        'failed',
        err instanceof Error ? err.message : 'unknown'
      );
    }
  }
}
