/**
 * Generate HTML + plain-text previews for Ceramika Nero transactional emails.
 *
 * Usage:
 *   npm run email:previews
 *   npx tsx scripts/generate-email-previews.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOrderEmail } from '../lib/email/catalog';
import { renderEmail } from '../lib/email/render';
import {
  fixtureAdminNewOrder,
  fixtureCancellation,
  fixtureCheckoutExpired,
  fixtureOrderShipped,
  fixturePaymentConfirmed,
  fixturePaymentFailed,
  fixtureReadyForPickup,
  fixtureRefundCompleted,
  fixtureShippingQuoteConfirmedStripe,
  fixtureShippingQuotePending,
  fixtureStripeProcessing,
  fixtureWorkshopManualTransfer,
} from '../lib/email/fixtures';
import type { OrderEmailContext, OrderEmailType } from '../lib/email/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../tmp/email-previews');

type PreviewSpec = {
  slug: string;
  type: OrderEmailType;
  ctx: OrderEmailContext;
  label: string;
};

const previews: PreviewSpec[] = [
  {
    slug: '01-workshop-manual-transfer',
    type: 'manual_transfer_requested',
    ctx: fixtureWorkshopManualTransfer,
    label: 'Workshop awaiting manual transfer',
  },
  {
    slug: '02-workshop-payment-confirmed',
    type: 'payment_received',
    ctx: fixturePaymentConfirmed,
    label: 'Workshop Stripe payment confirmed',
  },
  {
    slug: '03-stripe-payment-processing',
    type: 'stripe_payment_processing',
    ctx: fixtureStripeProcessing,
    label: 'Stripe payment processing',
  },
  {
    slug: '04a-payment-failed',
    type: 'payment_failed',
    ctx: fixturePaymentFailed,
    label: 'Payment failed',
  },
  {
    slug: '04b-checkout-expired',
    type: 'checkout_expired',
    ctx: fixtureCheckoutExpired,
    label: 'Checkout expired',
  },
  {
    slug: '05-shipping-quote-pending',
    type: 'customer_confirmation',
    ctx: fixtureShippingQuotePending,
    label: 'Shipping quote pending',
  },
  {
    slug: '06-shipping-quote-confirmed-stripe',
    type: 'shipping_quote_confirmed',
    ctx: fixtureShippingQuoteConfirmedStripe,
    label: 'Shipping quote confirmed with online-payment CTA',
  },
  {
    slug: '07a-cancellation',
    type: 'cancellation',
    ctx: fixtureCancellation,
    label: 'Cancellation',
  },
  {
    slug: '07b-refund-completed',
    type: 'refund_completed',
    ctx: fixtureRefundCompleted,
    label: 'Refund completed',
  },
  {
    slug: '08-admin-new-order',
    type: 'admin_notification',
    ctx: fixtureAdminNewOrder,
    label: 'Admin new-order notification',
  },
  {
    slug: '09-ready-for-pickup',
    type: 'ready_for_pickup',
    ctx: fixtureReadyForPickup,
    label: 'Ready for pickup',
  },
  {
    slug: '10-shipped-with-tracking',
    type: 'order_shipped',
    ctx: fixtureOrderShipped,
    label: 'Shipped with tracking',
  },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const indexLines: string[] = [
    '# Ceramika Nero — email previews',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];

  for (const spec of previews) {
    const template = buildOrderEmail(spec.type, spec.ctx);
    const rendered = await renderEmail(template);
    const htmlPath = path.join(outDir, `${spec.slug}.html`);
    const txtPath = path.join(outDir, `${spec.slug}.txt`);
    const meta = [
      `Subject: ${rendered.subject}`,
      `Preheader: ${rendered.preheader}`,
      `Type: ${spec.type}`,
      `Label: ${spec.label}`,
      '',
      rendered.text,
    ].join('\n');

    await writeFile(htmlPath, rendered.html, 'utf8');
    await writeFile(txtPath, meta, 'utf8');
    indexLines.push(`- ${spec.slug}: ${spec.label} (${spec.type})`);
    console.log(`Wrote ${spec.slug}`);
  }

  await writeFile(
    path.join(outDir, 'README.md'),
    indexLines.join('\n') + '\n',
    'utf8'
  );
  console.log(`\nPreviews written to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
