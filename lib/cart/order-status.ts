import 'server-only';
import { createHash } from 'node:crypto';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';

export type CustomerOrderStatus = {
  orderReference: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: string;
  subtotalGrossGrosz: number;
  shippingGrossGrosz: number;
  totalGrossGrosz: number;
  shippingQuoteRequired: boolean;
  bookingReferences: string[];
  items: Array<{
    title: string;
    quantity: number;
    lineTotalGrossGrosz: number;
    itemType: string;
    fulfillmentMethod: string | null;
  }>;
  hasDeliveryAddress: boolean;
  city?: string | null;
  trackingReference?: string | null;
};

function hashLookupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Load a customer-safe order view by opaque public lookup token.
 * Uses service role only after hashing; never accepts sequential IDs.
 */
export async function getOrderStatusByPublicToken(
  token: string
): Promise<CustomerOrderStatus | null> {
  const trimmed = token.trim();
  if (!/^[a-f0-9]{32,128}$/i.test(trimmed)) return null;

  const hash = hashLookupToken(trimmed);
  const supabase = createCartAdminClient();

  let { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_reference,
      status,
      payment_status,
      fulfillment_status,
      fulfillment_method,
      subtotal_gross_grosz,
      shipping_gross_grosz,
      total_gross_grosz,
      shipping_quote_required,
      tracking_reference,
      order_items (
        title_snapshot, quantity, line_total_gross_grosz, item_type, fulfillment_method
      ),
      order_addresses (city)
    `
    )
    .eq('public_lookup_token_hash', hash)
    .maybeSingle();

  // Pre-migration-14 databases omit tracking_reference.
  if (error?.message?.includes('tracking_reference')) {
    ({ data: order, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_reference,
        status,
        payment_status,
        fulfillment_status,
        fulfillment_method,
        subtotal_gross_grosz,
        shipping_gross_grosz,
        total_gross_grosz,
        shipping_quote_required,
        order_items (
          title_snapshot, quantity, line_total_gross_grosz, item_type, fulfillment_method
        ),
        order_addresses (city)
      `
      )
      .eq('public_lookup_token_hash', hash)
      .maybeSingle());
  }

  if (error || !order) {
    if (error) {
      console.error('order status lookup failed', { code: error.code });
    }
    return null;
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_reference')
    .eq('order_id', order.id);

  const address = Array.isArray(order.order_addresses)
    ? order.order_addresses[0]
    : order.order_addresses;

  const items = (order.order_items ?? []) as Array<{
    title_snapshot: string;
    quantity: number;
    line_total_gross_grosz: number;
    item_type: string;
    fulfillment_method: string | null;
  }>;

  return {
    orderReference: order.order_reference,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    fulfillmentMethod: order.fulfillment_method,
    subtotalGrossGrosz: order.subtotal_gross_grosz,
    shippingGrossGrosz: order.shipping_gross_grosz,
    totalGrossGrosz: order.total_gross_grosz,
    shippingQuoteRequired: order.shipping_quote_required,
    bookingReferences: (
      (bookings ?? []) as Array<{ booking_reference: string }>
    ).map((b) => b.booking_reference),
    items: items.map((i) => ({
      title: i.title_snapshot,
      quantity: i.quantity,
      lineTotalGrossGrosz: i.line_total_gross_grosz,
      itemType: i.item_type,
      fulfillmentMethod: i.fulfillment_method,
    })),
    hasDeliveryAddress: Boolean(address),
    city: address?.city ?? null,
    trackingReference:
      (order as { tracking_reference?: string | null }).tracking_reference ??
      null,
  };
}
