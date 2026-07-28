import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  assertBookingCatalogComplete,
  assertOrderCatalogComplete,
  bookingEmailCatalog,
  buildBookingEmail,
  buildOrderEmail,
  orderEmailCatalog,
} from '@/lib/email/catalog';
import { escapeHtml } from '@/lib/email/escape';
import {
  formatBankAccountGrouped,
  formatMoneyPln,
  getEmailSiteUrl,
} from '@/lib/email/format';
import { renderEmail } from '@/lib/email/render';
import {
  fixtureBookingConfirmation,
  fixturePaymentConfirmed,
  fixtureShippingQuoteConfirmedStripe,
  fixtureWorkshopManualTransfer,
  orderFixtures,
} from '@/lib/email/fixtures';
import {
  BOOKING_EMAIL_TYPES,
  ORDER_EMAIL_TYPES,
  type BookingEmailType,
  type OrderEmailContext,
  type OrderEmailType,
} from '@/lib/email/types';

afterEach(() => {
  vi.unstubAllEnvs();
});

function fixtureForOrderType(type: OrderEmailType): OrderEmailContext {
  switch (type) {
    case 'customer_confirmation':
      return orderFixtures.shippingQuotePending;
    case 'admin_notification':
    case 'admin_payment_problem':
      return orderFixtures.adminNewOrder;
    case 'shipping_quote_confirmed':
      return fixtureShippingQuoteConfirmedStripe;
    case 'payment_received':
      return fixturePaymentConfirmed;
    case 'ready_for_pickup':
      return orderFixtures.readyForPickup;
    case 'order_shipped':
      return orderFixtures.orderShipped;
    case 'cancellation':
      return orderFixtures.cancellation;
    case 'awaiting_stripe_payment':
    case 'payment_failed':
      return orderFixtures.paymentFailed;
    case 'stripe_payment_processing':
      return orderFixtures.stripeProcessing;
    case 'checkout_expired':
      return orderFixtures.checkoutExpired;
    case 'refund_initiated':
    case 'refund_completed':
    case 'refund_failed':
      return orderFixtures.refundCompleted;
    case 'manual_transfer_requested':
      return fixtureWorkshopManualTransfer;
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

describe('email catalog exhaustiveness', () => {
  it('covers every order_emails email_type', () => {
    expect(assertOrderCatalogComplete()).toEqual([...ORDER_EMAIL_TYPES]);
    for (const type of ORDER_EMAIL_TYPES) {
      expect(orderEmailCatalog[type]).toBeTypeOf('function');
    }
  });

  it('covers every booking_emails email_type', () => {
    expect(assertBookingCatalogComplete()).toEqual([...BOOKING_EMAIL_TYPES]);
    for (const type of BOOKING_EMAIL_TYPES) {
      expect(bookingEmailCatalog[type]).toBeTypeOf('function');
    }
  });
});

describe('email catalog render quality', () => {
  it('renders html+text for every order type', async () => {
    for (const type of ORDER_EMAIL_TYPES) {
      const rendered = await renderEmail(
        buildOrderEmail(type, fixtureForOrderType(type))
      );
      expect(rendered.html.length).toBeGreaterThan(200);
      expect(rendered.text.length).toBeGreaterThan(40);
      expect(rendered.subject.length).toBeGreaterThan(5);
      expect(rendered.preheader.length).toBeGreaterThan(5);
      expect(rendered.html).not.toContain('Stripe nie jest aktywowany');
      expect(rendered.text).not.toContain('Stripe nie jest aktywowany');
      expect(rendered.html).not.toContain('netlify.app');
      expect(rendered.text).not.toContain('netlify.app');
      expect(rendered.html).toContain('ceramikanero.pl');
      expect(rendered.html).not.toMatch(/\bundefined\b/);
    }
  }, 60_000);

  it('renders html+text for every booking type', async () => {
    for (const type of BOOKING_EMAIL_TYPES) {
      const rendered = await renderEmail(
        buildBookingEmail(type as BookingEmailType, fixtureBookingConfirmation)
      );
      expect(rendered.html.length).toBeGreaterThan(200);
      expect(rendered.text.length).toBeGreaterThan(40);
      expect(rendered.html).not.toContain('Stripe nie jest aktywowany');
      expect(rendered.html).toContain('ceramikanero.pl');
      expect(rendered.html).not.toContain('netlify.app');
    }
  }, 30_000);

  it('formats money as Polish grosz/PLN', () => {
    expect(formatMoneyPln(14900)).toBe('149,00 zł');
    expect(formatMoneyPln(37800)).toBe('378,00 zł');
  });

  it('groups bank account numbers', () => {
    expect(formatBankAccountGrouped('30114020040000310283149467')).toBe(
      '30 1140 2004 0000 3102 8314 9467'
    );
  });

  it('escapes HTML entities', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    );
  });

  it('never returns netlify.app from getEmailSiteUrl', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.netlify.app');
    expect(getEmailSiteUrl()).toBe('https://ceramikanero.pl');
    expect(getEmailSiteUrl('https://foo.netlify.app')).toBe(
      'https://ceramikanero.pl'
    );
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl/');
    expect(getEmailSiteUrl()).toBe('https://ceramikanero.pl');
  });

  it('manual transfer email includes bank details and money', async () => {
    const rendered = await renderEmail(
      buildOrderEmail(
        'manual_transfer_requested',
        fixtureWorkshopManualTransfer
      )
    );
    expect(rendered.html).toContain('378,00 zł');
    expect(rendered.text).toContain('378,00 zł');
    expect(rendered.html).toMatch(/30\s*1140\s*2004/);
    expect(rendered.subject).toContain('CN-ORD-2401');
  });

  it('payment_received customer copy matches confirmation wording', async () => {
    const rendered = await renderEmail(
      buildOrderEmail('payment_received', fixturePaymentConfirmed)
    );
    expect(rendered.subject).toBe('Płatność potwierdzona — Ceramika Nero');
    expect(rendered.preheader).toContain('Twoje miejsce jest potwierdzone');
    expect(rendered.html).toContain('Nic więcej nie trzeba płacić');
    expect(rendered.html).toContain('Kwota opłacona');
  });
});
