import { siteContact } from '@/lib/fixtures/navigation';
import type {
  BookingEmailContext,
  OrderEmailContext,
  PaymentInstructionsMode,
} from '@/lib/email/types';

const SITE = 'https://ceramikanero.pl';

const bankTransfer = (
  reference: string,
  amountGrosz: number
): PaymentInstructionsMode => ({
  mode: 'bank_transfer',
  details: {
    recipient: siteContact.brand,
    accountNumber: siteContact.bankAccount.replace(/\s/g, ''),
    title: reference,
    amountGrosz,
    bankName: 'mBank',
    deadlineNote: 'Prosimy o przelew w ciągu 3 dni roboczych.',
  },
});

const stripeCta = (amountGrosz: number): PaymentInstructionsMode => ({
  mode: 'stripe_pay_cta',
  payUrl: `${SITE}/platnosc/przyklad?ref=CN-DEMO`,
  amountGrosz,
  buttonLabel: 'Opłać online',
});

/** Sanitized fixture: workshop awaiting manual bank transfer. */
export const fixtureWorkshopManualTransfer: OrderEmailContext = {
  orderReference: 'CN-ORD-2401',
  customerName: 'Anna Kowalska',
  customerEmail: 'anna@example.com',
  customerPhone: '+48 500 100 200',
  items: [
    {
      title: 'Glina do wina',
      quantity: 2,
      unitPriceGrosz: 18900,
      lineTotalGrosz: 37800,
      kind: 'workshop',
    },
  ],
  workshops: [
    {
      title: 'Glina do wina',
      startsAt: '2026-08-01T17:00:00.000Z',
      location: 'ul. Podgórna 3, Suchy Las',
      quantity: 2,
      unitPriceGrosz: 18900,
      participants: [
        { displayName: 'Anna Kowalska', age: null },
        { displayName: 'Jan Kowalski', age: 12 },
      ],
    },
  ],
  bookingReferences: ['CN-BK-8801'],
  subtotalGrosz: 37800,
  totalGrosz: 37800,
  payment: bankTransfer('CN-ORD-2401', 37800),
  siteUrl: SITE,
};

/** Workshop / order with Stripe payment confirmed. */
export const fixturePaymentConfirmed: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2402',
  bookingReferences: ['CN-BK-8802'],
  payment: { mode: 'none' },
};

/** Stripe payment processing. */
export const fixtureStripeProcessing: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2403',
  payment: { mode: 'processing' },
};

/** Payment failed / checkout expired base. */
export const fixturePaymentFailed: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2404',
  payment: stripeCta(37800),
};

export const fixtureCheckoutExpired: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2405',
  payment: { mode: 'none' },
};

/** Product order awaiting shipping quote. */
export const fixtureShippingQuotePending: OrderEmailContext = {
  orderReference: 'CN-ORD-2501',
  customerName: 'Marta Nowak',
  customerEmail: 'marta@example.com',
  items: [
    {
      title: 'Misa ceramiczna — terakota',
      quantity: 1,
      unitPriceGrosz: 14900,
      lineTotalGrosz: 14900,
      kind: 'product',
      fulfillmentLabel: 'wysyłka',
    },
    {
      title: 'Kubek atelier',
      quantity: 2,
      unitPriceGrosz: 8900,
      lineTotalGrosz: 17800,
      kind: 'product',
      fulfillmentLabel: 'wysyłka',
    },
  ],
  subtotalGrosz: 32700,
  totalGrosz: 32700,
  shippingQuoteRequired: true,
  fulfillmentMethod: 'shipping',
  shippingAddress: {
    recipientName: 'Marta Nowak',
    streetLine1: 'ul. Kwiatowa 12/4',
    postalCode: '60-001',
    city: 'Poznań',
    country: 'Polska',
  },
  payment: { mode: 'shipping_pending' },
  siteUrl: SITE,
};

/** Shipping quote confirmed with online payment CTA. */
export const fixtureShippingQuoteConfirmedStripe: OrderEmailContext = {
  ...fixtureShippingQuotePending,
  orderReference: 'CN-ORD-2502',
  shippingQuoteRequired: false,
  shippingGrosz: 1900,
  totalGrosz: 34600,
  payment: stripeCta(34600),
};

/** Cancellation / refund. */
export const fixtureCancellation: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2601',
  cancellationReason: 'Na życzenie klienta',
  payment: { mode: 'none' },
};

export const fixtureRefundCompleted: OrderEmailContext = {
  ...fixtureWorkshopManualTransfer,
  orderReference: 'CN-ORD-2602',
  refundAmountGrosz: 37800,
  payment: { mode: 'none' },
};

/** Admin new-order notification. */
export const fixtureAdminNewOrder: OrderEmailContext = {
  ...fixtureShippingQuotePending,
  orderReference: 'CN-ORD-2701',
  adminNotes: 'Klient prosi o kontakt przed wysyłką.',
  payment: { mode: 'shipping_pending' },
};

/** Ready for pickup. */
export const fixtureReadyForPickup: OrderEmailContext = {
  orderReference: 'CN-ORD-2801',
  customerName: 'Piotr Zieliński',
  customerEmail: 'piotr@example.com',
  items: [
    {
      title: 'Talerz deserowy',
      quantity: 4,
      unitPriceGrosz: 6500,
      lineTotalGrosz: 26000,
      kind: 'product',
      fulfillmentLabel: 'odbiór',
    },
  ],
  subtotalGrosz: 26000,
  totalGrosz: 26000,
  fulfillmentMethod: 'pickup',
  pickupNote:
    'Odbiór w pracowni: ul. Podgórna 3, Suchy Las — prosimy o wcześniejszy kontakt telefoniczny.',
  payment: { mode: 'none' },
  siteUrl: SITE,
};

/** Shipped with tracking. */
export const fixtureOrderShipped: OrderEmailContext = {
  ...fixtureShippingQuoteConfirmedStripe,
  orderReference: 'CN-ORD-2901',
  trackingReference: 'PX123456789PL',
  payment: { mode: 'none' },
};

export const fixtureBookingConfirmation: BookingEmailContext = {
  reference: 'CN-BK-9901',
  workshopTitle: 'Warsztat toczenia dla dorosłych',
  sessionStartsAt: '2026-09-12T16:00:00.000Z',
  sessionLocation: 'ul. Podgórna 3, Suchy Las',
  quantity: 1,
  unitPriceGrosz: 22000,
  totalGrosz: 22000,
  customerName: 'Ewa Wiśniewska',
  customerEmail: 'ewa@example.com',
  customerPhone: '532 279 101',
  participants: [{ displayName: 'Ewa Wiśniewska', age: null }],
  cancellationUrl: `${SITE}/rezerwacja/anulowanie?t=demo`,
  payment: bankTransfer('CN-BK-9901', 22000),
  siteUrl: SITE,
};

export const orderFixtures = {
  workshopManualTransfer: fixtureWorkshopManualTransfer,
  paymentConfirmed: fixturePaymentConfirmed,
  stripeProcessing: fixtureStripeProcessing,
  paymentFailed: fixturePaymentFailed,
  checkoutExpired: fixtureCheckoutExpired,
  shippingQuotePending: fixtureShippingQuotePending,
  shippingQuoteConfirmedStripe: fixtureShippingQuoteConfirmedStripe,
  cancellation: fixtureCancellation,
  refundCompleted: fixtureRefundCompleted,
  adminNewOrder: fixtureAdminNewOrder,
  readyForPickup: fixtureReadyForPickup,
  orderShipped: fixtureOrderShipped,
} as const;

export const bookingFixtures = {
  confirmation: fixtureBookingConfirmation,
} as const;
