import type { Metadata } from 'next';
import { CheckoutPageClient } from '@/components/clone/checkout-page-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Zamówienie | Ceramika Nero',
  robots: { index: false, follow: false },
};

export default function CartCheckoutPage() {
  return <CheckoutPageClient />;
}
