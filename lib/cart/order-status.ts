import 'server-only';
import { createHash } from 'node:crypto';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import type { CustomerOrderStatus } from '@/lib/cart/customer-order-status';

export type { CustomerOrderStatus } from '@/lib/cart/customer-order-status';

function hashLookupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

type LatestPayment = {
  status: string;
  provider: string | null;
  failure_message: string | null;
  provider_checkout_id: string | null;
};

function derivePaymentFlags(input: {
  shippingQuoteRequired: boolean;
  paymentStatus: string;
  status: string;
  selectedPaymentMethod: string | null;
  payment: LatestPayment | null;
}): {
  paymentReconciling: boolean;
  canStartStripePayment: boolean;
  paymentProviderHint: string | null;
} {
  const failureMessage = input.payment?.failure_message ?? null;
  // Only "Stripe already took money / session complete" — not a mere open Checkout.
  const paymentReconciling =
    failureMessage === 'stripe_checkout_reconciling' ||
    input.payment?.status === 'processing';

  const terminalOrder =
    input.status === 'cancelled' ||
    input.status === 'expired' ||
    input.status === 'refunded';

  const canStartStripePayment =
    !input.shippingQuoteRequired &&
    input.paymentStatus !== 'paid' &&
    !terminalOrder &&
    !paymentReconciling &&
    input.payment?.status !== 'paid' &&
    (input.selectedPaymentMethod === 'stripe' ||
      input.paymentStatus === 'failed');

  return {
    paymentReconciling,
    canStartStripePayment,
    paymentProviderHint: null,
  };
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
      selected_payment_method,
      tracking_reference,
      order_items (
        title_snapshot, quantity, line_total_gross_grosz, item_type, fulfillment_method
      ),
      order_addresses (city)
    `
    )
    .eq('public_lookup_token_hash', hash)
    .maybeSingle();

  // Pre-migration-15 databases omit selected_payment_method.
  if (error?.message?.includes('selected_payment_method')) {
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
        tracking_reference,
        order_items (
          title_snapshot, quantity, line_total_gross_grosz, item_type, fulfillment_method
        ),
        order_addresses (city)
      `
      )
      .eq('public_lookup_token_hash', hash)
      .maybeSingle());
  }

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

  const { data: latestPayments } = await supabase
    .from('payments')
    .select('status, provider, failure_message, provider_checkout_id')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const payment =
    ((latestPayments ?? [])[0] as LatestPayment | undefined) ?? null;

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

  const selectedPaymentMethod =
    (order as { selected_payment_method?: string | null })
      .selected_payment_method ?? null;

  const flags = derivePaymentFlags({
    shippingQuoteRequired: order.shipping_quote_required,
    paymentStatus: order.payment_status,
    status: order.status,
    selectedPaymentMethod,
    payment,
  });

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
    selectedPaymentMethod,
    paymentReconciling: flags.paymentReconciling,
    canStartStripePayment: flags.canStartStripePayment,
    paymentProviderHint: flags.paymentProviderHint,
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
