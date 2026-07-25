import type { Metadata } from 'next';
import { CartPageClient } from '@/components/clone/cart-page-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Koszyk | Ceramika Nero',
  description: 'Koszyk warsztatów i produktów Ceramika Nero.',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CartPageClient />;
}
