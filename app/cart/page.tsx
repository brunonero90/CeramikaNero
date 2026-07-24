import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import { CartPageClient } from '@/components/clone/cart-page-client';
import { getArchivePage } from '@/lib/clone/archive';

const ROUTE = '/cart' as const;

export const metadata: Metadata = {
  title: getArchivePage(ROUTE)?.title ?? 'Koszyk',
};

export default function CartPage() {
  const page = getArchivePage(ROUTE);
  if (!page) notFound();
  return (
    <div className="bg-surface-bg">
      <ArchivePageView page={page} />
      <CartPageClient />
    </div>
  );
}
