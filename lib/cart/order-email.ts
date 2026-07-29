import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { deliverBookingEmail } from '@/lib/booking/email-transport';
import { buildOrderEmail } from '@/lib/email/catalog';
import { renderEmail } from '@/lib/email/render';
import { getEmailSiteUrl } from '@/lib/email/format';
import type {
  BankTransferDetails,
  EmailLineItem,
  OrderEmailContext,
  OrderEmailType,
  PaymentInstructionsMode,
  WorkshopDetail,
} from '@/lib/email/types';
import {
  buildTransferTitle,
  formatBankAccountForDisplay,
  loadBankTransferConfig,
} from '@/lib/payments/bank-transfer';

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

type OrderRow = {
  id: string;
  order_reference: string;
  status: string;
  payment_status: string;
  fulfillment_method: string | null;
  subtotal_gross_grosz: number;
  shipping_gross_grosz: number;
  total_gross_grosz: number;
  shipping_quote_required: boolean;
  selected_payment_method?: string | null;
  tracking_reference?: string | null;
  public_lookup_token_hash?: string | null;
  customer_profiles: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
  } | null;
  order_items: Array<{
    item_type: string;
    title_snapshot: string;
    quantity: number;
    unit_price_gross_grosz: number;
    line_total_gross_grosz: number;
    fulfillment_method: string | null;
    metadata?: Record<string, unknown> | null;
    booking_id?: string | null;
  }> | null;
  order_addresses:
    | {
        recipient_name: string;
        street_line1: string;
        street_line2?: string | null;
        postal_code: string;
        city: string;
        country: string;
      }
    | Array<{
        recipient_name: string;
        street_line1: string;
        street_line2?: string | null;
        postal_code: string;
        city: string;
        country: string;
      }>
    | null;
};

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  const supabase = createCartAdminClient();
  let { data: order, error } = await supabase
    .from('orders')
    .select(
      `
      id,
      order_reference,
      status,
      payment_status,
      fulfillment_method,
      subtotal_gross_grosz,
      shipping_gross_grosz,
      total_gross_grosz,
      shipping_quote_required,
      selected_payment_method,
      tracking_reference,
      customer_profiles (email, first_name, last_name, phone),
      order_items (
        item_type, title_snapshot, quantity, unit_price_gross_grosz,
        line_total_gross_grosz, fulfillment_method, metadata, booking_id
      ),
      order_addresses (
        recipient_name, street_line1, street_line2, postal_code, city, country
      )
    `
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error?.message?.includes('selected_payment_method')) {
    ({ data: order, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_reference,
        status,
        payment_status,
        fulfillment_method,
        subtotal_gross_grosz,
        shipping_gross_grosz,
        total_gross_grosz,
        shipping_quote_required,
        tracking_reference,
        customer_profiles (email, first_name, last_name, phone),
        order_items (
          item_type, title_snapshot, quantity, unit_price_gross_grosz,
          line_total_gross_grosz, fulfillment_method, metadata, booking_id
        ),
        order_addresses (
          recipient_name, street_line1, street_line2, postal_code, city, country
        )
      `
      )
      .eq('id', orderId)
      .maybeSingle());
  }

  if (error?.message?.includes('tracking_reference')) {
    ({ data: order, error } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_reference,
        status,
        payment_status,
        fulfillment_method,
        subtotal_gross_grosz,
        shipping_gross_grosz,
        total_gross_grosz,
        shipping_quote_required,
        customer_profiles (email, first_name, last_name, phone),
        order_items (
          item_type, title_snapshot, quantity, unit_price_gross_grosz,
          line_total_gross_grosz, fulfillment_method, metadata, booking_id
        ),
        order_addresses (
          recipient_name, street_line1, street_line2, postal_code, city, country
        )
      `
      )
      .eq('id', orderId)
      .maybeSingle());
  }

  if (error || !order) {
    if (error) console.error('load order for email failed', error.message);
    return null;
  }
  return order as unknown as OrderRow;
}

async function loadWorkshopsAndBookings(orderId: string): Promise<{
  bookingRefs: string[];
  workshops: WorkshopDetail[];
}> {
  const supabase = createCartAdminClient();
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      booking_reference,
      quantity,
      unit_price_gross_grosz,
      workshop_sessions (
        starts_at,
        location_name,
        location_address,
        workshops (title)
      ),
      booking_participants (display_name, age)
    `
    )
    .eq('order_id', orderId);

  const workshops: WorkshopDetail[] = [];
  const bookingRefs: string[] = [];

  for (const b of bookings ?? []) {
    const row = b as {
      booking_reference: string;
      quantity: number;
      unit_price_gross_grosz: number;
      workshop_sessions: {
        starts_at: string;
        location_name: string | null;
        location_address: string | null;
        workshops: { title: string } | null;
      } | null;
      booking_participants: Array<{
        display_name: string | null;
        age: number | null;
      }> | null;
    };
    bookingRefs.push(row.booking_reference);
    const session = row.workshop_sessions;
    if (!session) continue;
    const location = [session.location_name, session.location_address]
      .filter(Boolean)
      .join(', ');
    workshops.push({
      title: session.workshops?.title ?? 'Warsztat',
      startsAt: session.starts_at,
      location: location || null,
      quantity: row.quantity,
      unitPriceGrosz: row.unit_price_gross_grosz,
      participants: (row.booking_participants ?? []).map((p) => ({
        displayName: p.display_name,
        age: p.age,
      })),
    });
  }

  return { bookingRefs, workshops };
}

function mapItems(order: OrderRow): EmailLineItem[] {
  return (order.order_items ?? []).map((i) => ({
    title: i.title_snapshot,
    quantity: i.quantity,
    unitPriceGrosz: i.unit_price_gross_grosz,
    lineTotalGrosz: i.line_total_gross_grosz,
    kind:
      i.item_type === 'workshop_session'
        ? 'workshop'
        : i.item_type === 'physical_product' || i.item_type === 'studio_service'
          ? 'product'
          : 'other',
    fulfillmentLabel:
      i.fulfillment_method === 'shipping'
        ? 'wysyłka'
        : i.fulfillment_method === 'pickup'
          ? 'odbiór'
          : null,
  }));
}

async function buildBankDetails(
  orderReference: string,
  amountGrosz: number
): Promise<BankTransferDetails | null> {
  const loaded = await loadBankTransferConfig();
  if (!loaded.ok) return null;
  const { config } = loaded;
  return {
    recipient: config.recipient,
    accountNumber: formatBankAccountForDisplay(config.accountNumber),
    title: buildTransferTitle(config.titleTemplate, orderReference),
    amountGrosz,
    bankName: config.bankName,
    deadlineNote: config.deadlineNote,
    extraInstructions: config.extraInstructions,
  };
}

async function resolvePaymentMode(
  order: OrderRow,
  opts?: { payUrl?: string | null; forceMode?: PaymentInstructionsMode['mode'] }
): Promise<PaymentInstructionsMode> {
  if (opts?.forceMode === 'shipping_pending' || order.shipping_quote_required) {
    return {
      mode: 'shipping_pending',
      message:
        'Koszt wysyłki ustalamy indywidualnie. Nie przelewaj środków i nie płac online, dopóki nie otrzymasz drugiej wiadomości z finalną kwotą.',
    };
  }

  if (opts?.forceMode === 'processing') {
    return {
      mode: 'processing',
      message:
        'Otrzymaliśmy zgłoszenie płatności. Potwierdzenie pojawi się, gdy bank lub operator zakończy przetwarzanie (np. BLIK / Przelewy24).',
    };
  }

  const method = order.selected_payment_method ?? 'bank_transfer';

  if (method === 'stripe') {
    if (opts?.payUrl) {
      return {
        mode: 'stripe_pay_cta',
        payUrl: opts.payUrl,
        amountGrosz: order.total_gross_grosz,
        buttonLabel: 'Zapłać online',
      };
    }
    return { mode: 'none' };
  }

  const details = await buildBankDetails(
    order.order_reference,
    order.total_gross_grosz
  );
  if (!details) {
    // Incomplete bank config — do not send useless payment instructions.
    return { mode: 'none' };
  }
  return { mode: 'bank_transfer', details };
}

async function buildOrderEmailContext(
  order: OrderRow,
  payment?: PaymentInstructionsMode
): Promise<OrderEmailContext> {
  const { bookingRefs, workshops } = await loadWorkshopsAndBookings(order.id);
  const profile = order.customer_profiles;
  const addressRaw = Array.isArray(order.order_addresses)
    ? order.order_addresses[0]
    : order.order_addresses;

  return {
    orderReference: order.order_reference,
    customerName: profile
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : 'Klient',
    customerEmail: profile?.email ?? '',
    customerPhone: profile?.phone ?? null,
    items: mapItems(order),
    workshops,
    subtotalGrosz: order.subtotal_gross_grosz,
    shippingGrosz: order.shipping_gross_grosz,
    totalGrosz: order.total_gross_grosz,
    shippingQuoteRequired: order.shipping_quote_required,
    fulfillmentMethod:
      (order.fulfillment_method as OrderEmailContext['fulfillmentMethod']) ??
      null,
    shippingAddress: addressRaw
      ? {
          recipientName: addressRaw.recipient_name,
          streetLine1: addressRaw.street_line1,
          streetLine2: addressRaw.street_line2,
          postalCode: addressRaw.postal_code,
          city: addressRaw.city,
          country: addressRaw.country,
        }
      : null,
    trackingReference: order.tracking_reference ?? null,
    bookingReferences: bookingRefs,
    payment: payment ?? { mode: 'none' },
    siteUrl: getEmailSiteUrl(),
  };
}

async function queueEmailRow(input: {
  orderId: string;
  emailType: OrderEmailType;
  recipient: string;
  nextAttemptAt?: string | null;
}): Promise<string | null> {
  const supabase = createCartAdminClient();
  const { data: existing } = await supabase
    .from('order_emails')
    .select('id, status')
    .eq('order_id', input.orderId)
    .eq('email_type', input.emailType)
    .eq('recipient', input.recipient)
    .in('status', ['pending', 'sent'])
    .maybeSingle();

  if (existing?.status === 'sent') return null;
  if (existing?.id) {
    if (input.nextAttemptAt) {
      await supabase
        .from('order_emails')
        .update({
          next_attempt_at: input.nextAttemptAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('status', 'pending');
    }
    return existing.id as string;
  }

  const { data: inserted, error } = await supabase
    .from('order_emails')
    .insert({
      order_id: input.orderId,
      email_type: input.emailType,
      recipient: input.recipient,
      status: 'pending',
      ...(input.nextAttemptAt ? { next_attempt_at: input.nextAttemptAt } : {}),
    })
    .select('id')
    .maybeSingle();

  if (!error && inserted?.id) return inserted.id as string;

  // Pre-migration-15 DBs may reject expanded email_type values.
  const fallbackType =
    input.emailType === 'awaiting_stripe_payment' ||
    input.emailType === 'manual_transfer_requested' ||
    input.emailType === 'stripe_payment_processing' ||
    input.emailType === 'payment_failed' ||
    input.emailType === 'checkout_expired'
      ? 'customer_confirmation'
      : input.emailType === 'admin_payment_problem'
        ? 'admin_notification'
        : input.emailType === 'refund_initiated' ||
            input.emailType === 'refund_completed' ||
            input.emailType === 'refund_failed'
          ? 'cancellation'
          : null;

  if (fallbackType) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('order_emails')
      .insert({
        order_id: input.orderId,
        email_type: fallbackType,
        recipient: input.recipient,
        status: 'pending',
        ...(input.nextAttemptAt
          ? { next_attempt_at: input.nextAttemptAt }
          : {}),
      })
      .select('id')
      .maybeSingle();
    if (!fallbackError && fallback?.id) return fallback.id as string;
  }

  console.error('order email queue failed', error?.message);
  return null;
}

/**
 * Insert (or refresh) a pending order email scheduled for later dispatch.
 */
export async function queueDelayedOrderEmail(input: {
  orderId: string;
  emailType: OrderEmailType;
  recipient: string;
  delayMs: number;
}): Promise<string | null> {
  const nextAttemptAt = new Date(Date.now() + input.delayMs).toISOString();
  return queueEmailRow({
    orderId: input.orderId,
    emailType: input.emailType,
    recipient: input.recipient,
    nextAttemptAt,
  });
}

async function sendRenderedOrderEmail(input: {
  orderId: string;
  emailId: string;
  emailType: OrderEmailType;
  recipient: string;
  ctx: OrderEmailContext;
}): Promise<boolean> {
  const built = buildOrderEmail(input.emailType, input.ctx);
  const rendered = await renderEmail(built);

  try {
    const delivered = await deliverBookingEmail({
      bookingId: input.orderId,
      type: input.emailType,
      to: input.recipient,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (delivered.ok) {
      await markOrderEmail(input.emailId, 'sent');
      return true;
    }
    await markOrderEmail(
      input.emailId,
      'failed',
      delivered.errorMessage ?? 'delivery failed'
    );
    return false;
  } catch (err) {
    await markOrderEmail(
      input.emailId,
      'failed',
      err instanceof Error ? err.message : 'unknown'
    );
    return false;
  }
}

export async function queueAndSendTypedOrderEmail(input: {
  orderId: string;
  emailType: OrderEmailType;
  recipient: string;
  ctx: OrderEmailContext;
}): Promise<void> {
  const emailId = await queueEmailRow({
    orderId: input.orderId,
    emailType: input.emailType,
    recipient: input.recipient,
  });
  if (!emailId) return;
  await sendRenderedOrderEmail({
    orderId: input.orderId,
    emailId,
    emailType: input.emailType,
    recipient: input.recipient,
    ctx: input.ctx,
  });
}

function customerConfirmationType(order: OrderRow): OrderEmailType {
  if (order.shipping_quote_required) return 'customer_confirmation';
  if (order.selected_payment_method === 'stripe') {
    return 'awaiting_stripe_payment';
  }
  return 'manual_transfer_requested';
}

/**
 * Initial customer + admin emails after submit_cart_order.
 * For known-total bank transfer, requires complete bank config or skips
 * payment instructions (and logs) rather than emailing incomplete data.
 * Known-total Stripe awaiting-payment emails are delayed 5 minutes so a
 * fast webhook payment confirmation can skip the reminder.
 */
export async function notifyOrderCreated(
  orderId: string,
  opts?: { publicLookupToken?: string }
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;

  const profile = order.customer_profiles;
  if (!profile?.email) return;

  const method = order.selected_payment_method ?? 'bank_transfer';
  let payment = await resolvePaymentMode(order);

  if (
    !order.shipping_quote_required &&
    method === 'bank_transfer' &&
    payment.mode !== 'bank_transfer'
  ) {
    console.error(
      'order email: bank transfer config incomplete — skipping payment instructions',
      { orderId }
    );
  }

  const siteUrl = getEmailSiteUrl();
  const manageOrderUrl = opts?.publicLookupToken
    ? `${siteUrl}/zamowienie/${encodeURIComponent(opts.publicLookupToken)}`
    : null;

  // Stripe known-total: Checkout redirect usually happens first.
  if (method === 'stripe' && !order.shipping_quote_required) {
    payment = manageOrderUrl
      ? {
          mode: 'stripe_pay_cta',
          payUrl: manageOrderUrl,
          amountGrosz: order.total_gross_grosz,
          buttonLabel: 'Zapłać online',
        }
      : { mode: 'none' };
  }

  const ctx = await buildOrderEmailContext(order, payment);
  ctx.manageOrderUrl = manageOrderUrl;
  const customerType = customerConfirmationType(order);
  const delayStripeReminder =
    method === 'stripe' && !order.shipping_quote_required;

  if (delayStripeReminder) {
    await queueDelayedOrderEmail({
      orderId,
      emailType: 'awaiting_stripe_payment',
      recipient: profile.email,
      delayMs: 5 * 60_000,
    });
  } else {
    const supabase = createCartAdminClient();
    const { data: queued } = await supabase
      .from('order_emails')
      .select('id, email_type, recipient, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'failed']);

    const rows = queued ?? [];

    // Prefer typed customer email; migrate legacy customer_confirmation rows.
    const customerRow =
      rows.find((r: { email_type: string }) => r.email_type === customerType) ??
      rows.find(
        (r: { email_type: string }) => r.email_type === 'customer_confirmation'
      );

    if (customerRow && customerRow.status !== 'sent') {
      await sendRenderedOrderEmail({
        orderId,
        emailId: customerRow.id,
        emailType:
          customerRow.email_type === 'customer_confirmation'
            ? customerType
            : (customerRow.email_type as OrderEmailType),
        recipient: profile.email,
        ctx,
      });
    } else if (!customerRow) {
      await queueAndSendTypedOrderEmail({
        orderId,
        emailType: customerType,
        recipient: profile.email,
        ctx,
      });
    }
  }

  {
    const supabase = createCartAdminClient();
    const { data: queued } = await supabase
      .from('order_emails')
      .select('id, email_type, recipient, status')
      .eq('order_id', orderId)
      .in('status', ['pending', 'failed']);

    for (const row of (queued ?? []) as Array<{
      id: string;
      email_type: string;
      recipient: string;
      status: string;
    }>) {
      if (row.email_type !== 'admin_notification') continue;
      if (row.status === 'sent') continue;
      await sendRenderedOrderEmail({
        orderId,
        emailId: row.id,
        emailType: 'admin_notification',
        recipient: row.recipient,
        ctx,
      });
    }
  }
}

/**
 * Send (or skip) a delayed awaiting_stripe_payment reminder after re-checking
 * whether the order is already paid / terminal.
 */
export async function dispatchAwaitingStripeReminder(
  orderId: string
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;

  const profile = order.customer_profiles;
  if (!profile?.email) return;

  const supabase = createCartAdminClient();
  const paymentTerminal =
    order.payment_status === 'paid' ||
    order.payment_status === 'cancelled' ||
    order.payment_status === 'expired' ||
    order.payment_status === 'refunded' ||
    order.payment_status === 'failed';
  const orderTerminal =
    order.status === 'cancelled' ||
    order.status === 'expired' ||
    order.status === 'refunded';

  if (paymentTerminal || orderTerminal) {
    const skipNote = `skipped_${order.payment_status}`;
    await supabase
      .from('order_emails')
      .update({
        status: 'sent',
        error_message: skipNote,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .in('email_type', ['awaiting_stripe_payment', 'customer_confirmation'])
      .in('status', ['pending', 'failed']);
    return;
  }

  const manageOrderUrl = await loadManageOrderUrl(orderId);
  const payment = manageOrderUrl
    ? ({
        mode: 'stripe_pay_cta',
        payUrl: manageOrderUrl,
        amountGrosz: order.total_gross_grosz,
        buttonLabel: 'Zapłać online',
      } as const)
    : ({ mode: 'none' } as const);
  const ctx = await buildOrderEmailContext(order, payment);
  ctx.manageOrderUrl = manageOrderUrl;

  const { data: rows } = await supabase
    .from('order_emails')
    .select('id, email_type, recipient, status')
    .eq('order_id', orderId)
    .in('email_type', ['awaiting_stripe_payment', 'customer_confirmation'])
    .eq('recipient', profile.email)
    .in('status', ['pending', 'failed']);

  for (const row of rows ?? []) {
    await sendRenderedOrderEmail({
      orderId,
      emailId: row.id,
      emailType: 'awaiting_stripe_payment',
      recipient: profile.email,
      ctx,
    });
  }

  if (!(rows ?? []).length) {
    await queueAndSendTypedOrderEmail({
      orderId,
      emailType: 'awaiting_stripe_payment',
      recipient: profile.email,
      ctx,
    });
  }
}

async function loadManageOrderUrl(orderId: string): Promise<string | null> {
  const supabase = createCartAdminClient();
  const { data } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string
          ) => {
            maybeSingle: () => Promise<{
              data: { public_lookup_token?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from('order_portal_token_recovery')
    .select('public_lookup_token')
    .eq('order_id', orderId)
    .maybeSingle();
  const token = data?.public_lookup_token ?? '';
  if (!token) return null;
  return `${getEmailSiteUrl()}/zamowienie/${encodeURIComponent(token)}`;
}

export async function notifyShippingQuoteConfirmed(
  orderId: string
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order || order.shipping_quote_required) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;

  const method = order.selected_payment_method ?? 'bank_transfer';
  const manageOrderUrl = await loadManageOrderUrl(orderId);
  let payment: PaymentInstructionsMode;

  if (method === 'stripe') {
    payment = manageOrderUrl
      ? {
          mode: 'stripe_pay_cta',
          payUrl: manageOrderUrl,
          amountGrosz: order.total_gross_grosz,
          buttonLabel: 'Zapłać online',
        }
      : { mode: 'none' };
  } else {
    payment = await resolvePaymentMode(order);
    if (payment.mode !== 'bank_transfer') {
      console.error(
        'shipping quote confirmed but bank transfer config incomplete',
        { orderId }
      );
      return;
    }
  }

  // Sync payment row amount to final total.
  const supabase = createCartAdminClient();
  await supabase
    .from('payments')
    .update({
      amount_gross_grosz: order.total_gross_grosz,
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['created', 'pending']);

  const ctx = await buildOrderEmailContext(order, payment);
  ctx.manageOrderUrl = manageOrderUrl;
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: 'shipping_quote_confirmed',
    recipient: profile.email,
    ctx,
  });
}

export async function notifyOrderPaymentReceived(
  orderId: string
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const manageOrderUrl = await loadManageOrderUrl(orderId);
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  ctx.manageOrderUrl = manageOrderUrl;
  ctx.audience = 'customer';
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: 'payment_received',
    recipient: profile.email,
    ctx,
  });

  // Cancel delayed "pay again" reminders once payment is confirmed.
  const supabase = createCartAdminClient();
  await supabase
    .from('order_emails')
    .update({
      status: 'sent',
      error_message: 'skipped_paid',
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('email_type', ['awaiting_stripe_payment', 'customer_confirmation'])
    .in('status', ['pending', 'failed']);

  const adminEmail = process.env.BOOKING_ADMIN_EMAIL?.trim();
  if (adminEmail) {
    const adminCtx: OrderEmailContext = {
      ...ctx,
      audience: 'admin',
    };
    await queueAndSendTypedOrderEmail({
      orderId,
      emailType: 'payment_received',
      recipient: adminEmail,
      ctx: adminCtx,
    });
  }
}

export async function notifyOrderCancellation(orderId: string): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: 'cancellation',
    recipient: profile.email,
    ctx,
  });
}

export async function notifyOrderFulfilmentUpdate(
  orderId: string,
  kind: 'ready_for_pickup' | 'order_shipped'
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: kind,
    recipient: profile.email,
    ctx,
  });
}

export async function notifyOrderStripeProcessing(
  orderId: string
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const payment = await resolvePaymentMode(order, { forceMode: 'processing' });
  const ctx = await buildOrderEmailContext(order, payment);
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: 'stripe_payment_processing',
    recipient: profile.email,
    ctx,
  });
}

export async function notifyOrderPaymentFailed(
  orderId: string,
  kind: 'payment_failed' | 'checkout_expired' = 'payment_failed'
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: kind,
    recipient: profile.email,
    ctx,
  });
}

export async function notifyAdminOrderPaymentProblem(
  orderId: string
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const adminEmail = process.env.BOOKING_ADMIN_EMAIL?.trim();
  if (!adminEmail) return;
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: 'admin_payment_problem',
    recipient: adminEmail,
    ctx,
  });
}

export async function notifyOrderRefundEvent(
  orderId: string,
  kind: 'refund_initiated' | 'refund_completed' | 'refund_failed',
  refundAmountGrosz?: number
): Promise<void> {
  const order = await loadOrder(orderId);
  if (!order) return;
  const profile = order.customer_profiles;
  if (!profile?.email) return;
  const ctx = await buildOrderEmailContext(order, { mode: 'none' });
  ctx.refundAmountGrosz = refundAmountGrosz ?? order.total_gross_grosz;
  await queueAndSendTypedOrderEmail({
    orderId,
    emailType: kind,
    recipient: profile.email,
    ctx,
  });
}
