import type { ReactElement } from 'react';

export const ORDER_EMAIL_TYPES = [
  'customer_confirmation',
  'admin_notification',
  'shipping_quote_confirmed',
  'payment_received',
  'ready_for_pickup',
  'order_shipped',
  'cancellation',
  'awaiting_stripe_payment',
  'stripe_payment_processing',
  'payment_failed',
  'checkout_expired',
  'refund_initiated',
  'refund_completed',
  'refund_failed',
  'admin_payment_problem',
  'manual_transfer_requested',
] as const;

export type OrderEmailType = (typeof ORDER_EMAIL_TYPES)[number];

export const BOOKING_EMAIL_TYPES = [
  'confirmation',
  'cancellation',
  'refund',
  'manual_confirmation',
  'payment_problem',
  'admin_notification',
] as const;

export type BookingEmailType = (typeof BOOKING_EMAIL_TYPES)[number];

export type EmailLineItem = {
  title: string;
  quantity: number;
  unitPriceGrosz?: number;
  lineTotalGrosz: number;
  kind?: 'product' | 'workshop' | 'shipping' | 'other';
  fulfillmentLabel?: string | null;
  meta?: string | null;
};

export type EmailAddressBlock = {
  recipientName?: string | null;
  streetLine1: string;
  streetLine2?: string | null;
  postalCode: string;
  city: string;
  country?: string | null;
};

export type BankTransferDetails = {
  recipient: string;
  accountNumber: string;
  title: string;
  amountGrosz: number;
  bankName?: string | null;
  deadlineNote?: string | null;
  extraInstructions?: string | null;
};

export type PaymentInstructionsMode =
  | { mode: 'bank_transfer'; details: BankTransferDetails }
  | {
      mode: 'stripe_pay_cta';
      payUrl: string;
      amountGrosz?: number;
      buttonLabel?: string;
    }
  | { mode: 'shipping_pending'; message?: string }
  | { mode: 'processing'; message?: string }
  | { mode: 'none' };

export type WorkshopDetail = {
  title: string;
  startsAt: string;
  location?: string | null;
  quantity: number;
  unitPriceGrosz?: number;
  participants?: Array<{
    displayName: string | null;
    age?: number | null;
  }>;
};

export type OrderEmailContext = {
  orderReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  items: EmailLineItem[];
  workshops?: WorkshopDetail[];
  subtotalGrosz: number;
  shippingGrosz?: number | null;
  totalGrosz: number;
  shippingQuoteRequired?: boolean;
  fulfillmentMethod?: 'shipping' | 'pickup' | 'mixed' | 'none' | null;
  shippingAddress?: EmailAddressBlock | null;
  pickupNote?: string | null;
  trackingReference?: string | null;
  bookingReferences?: string[];
  payment?: PaymentInstructionsMode;
  cancellationReason?: string | null;
  refundAmountGrosz?: number | null;
  adminNotes?: string | null;
  siteUrl?: string | null;
  /** Opaque /zamowienie/[token] URL when known (e.g. right after checkout). */
  manageOrderUrl?: string | null;
};

export type BookingEmailContext = {
  reference: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionLocation?: string | null;
  quantity: number;
  unitPriceGrosz: number;
  totalGrosz: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  customerNotes?: string | null;
  participants: Array<{
    displayName: string | null;
    age?: number | null;
  }>;
  cancellationUrl?: string | null;
  payment?: PaymentInstructionsMode;
  reason?: string | null;
  refundAmountGrosz?: number | null;
  siteUrl?: string | null;
};

export type EmailTemplateResult = {
  subject: string;
  preheader: string;
  react: ReactElement;
  /** Optional hand-crafted plain text; render falls back to HTML→text. */
  text?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  preheader: string;
};
