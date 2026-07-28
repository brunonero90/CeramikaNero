import type {
  BookingEmailContext,
  BookingEmailType,
  EmailTemplateResult,
  OrderEmailContext,
  OrderEmailType,
} from '@/lib/email/types';
import { BOOKING_EMAIL_TYPES, ORDER_EMAIL_TYPES } from '@/lib/email/types';
import {
  buildAdminNotification,
  buildAdminPaymentProblem,
  buildAwaitingStripePayment,
  buildCancellation,
  buildCheckoutExpired,
  buildCustomerConfirmation,
  buildManualTransferRequested,
  buildOrderShipped,
  buildPaymentFailed,
  buildPaymentReceived,
  buildReadyForPickup,
  buildRefundCompleted,
  buildRefundFailed,
  buildRefundInitiated,
  buildShippingQuoteConfirmed,
  buildStripePaymentProcessing,
} from '@/lib/email/templates/orders';
import {
  buildBookingAdminNotification,
  buildBookingCancellation,
  buildBookingConfirmation,
  buildBookingManualConfirmation,
  buildBookingPaymentProblem,
  buildBookingRefund,
} from '@/lib/email/templates/bookings';

/**
 * Exhaustive mapping: adding an order_emails email_type without a template
 * is a TypeScript compile error.
 */
export const orderEmailCatalog: {
  [K in OrderEmailType]: (ctx: OrderEmailContext) => EmailTemplateResult;
} = {
  customer_confirmation: buildCustomerConfirmation,
  admin_notification: buildAdminNotification,
  shipping_quote_confirmed: buildShippingQuoteConfirmed,
  payment_received: buildPaymentReceived,
  ready_for_pickup: buildReadyForPickup,
  order_shipped: buildOrderShipped,
  cancellation: buildCancellation,
  awaiting_stripe_payment: buildAwaitingStripePayment,
  stripe_payment_processing: buildStripePaymentProcessing,
  payment_failed: buildPaymentFailed,
  checkout_expired: buildCheckoutExpired,
  refund_initiated: buildRefundInitiated,
  refund_completed: buildRefundCompleted,
  refund_failed: buildRefundFailed,
  admin_payment_problem: buildAdminPaymentProblem,
  manual_transfer_requested: buildManualTransferRequested,
};

/**
 * Exhaustive mapping: adding a booking_emails email_type without a template
 * is a TypeScript compile error.
 */
export const bookingEmailCatalog: {
  [K in BookingEmailType]: (ctx: BookingEmailContext) => EmailTemplateResult;
} = {
  confirmation: buildBookingConfirmation,
  cancellation: buildBookingCancellation,
  refund: buildBookingRefund,
  manual_confirmation: buildBookingManualConfirmation,
  payment_problem: buildBookingPaymentProblem,
  admin_notification: buildBookingAdminNotification,
};

export function buildOrderEmail(
  type: OrderEmailType,
  ctx: OrderEmailContext
): EmailTemplateResult {
  return orderEmailCatalog[type](ctx);
}

export function buildBookingEmail(
  type: BookingEmailType,
  ctx: BookingEmailContext
): EmailTemplateResult {
  return bookingEmailCatalog[type](ctx);
}

/** Compile-time exhaustiveness helpers for tests / tooling. */
export function assertOrderCatalogComplete(): readonly OrderEmailType[] {
  return ORDER_EMAIL_TYPES;
}

export function assertBookingCatalogComplete(): readonly BookingEmailType[] {
  return BOOKING_EMAIL_TYPES;
}

// Ensure catalog keys match the const arrays (extra runtime guard).
const _orderKeys = Object.keys(orderEmailCatalog) as OrderEmailType[];
const _bookingKeys = Object.keys(bookingEmailCatalog) as BookingEmailType[];

void _orderKeys;
void _bookingKeys;
