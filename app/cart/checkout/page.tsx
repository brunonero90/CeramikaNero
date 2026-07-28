import type { Metadata } from 'next';
import { CheckoutPageClient } from '@/components/clone/checkout-page-client';
import { getPublicPaymentOptions } from '@/lib/payments/provider';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Zamówienie | Ceramika Nero',
  robots: { index: false, follow: false },
};

export default function CartCheckoutPage() {
  const paymentOptions = getPublicPaymentOptions();
  return <CheckoutPageClient paymentOptions={paymentOptions} />;
}
