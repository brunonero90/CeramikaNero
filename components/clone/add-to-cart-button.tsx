'use client';

import { useLocalCart } from '@/components/clone/local-cart';

export function AddToLocalCartButton({
  id,
  title,
  priceLabel,
  href,
}: {
  id: string;
  title: string;
  priceLabel: string;
  href: string;
}) {
  const { addItem } = useLocalCart();
  return (
    <div className="mt-6 space-y-2">
      <button
        type="button"
        onClick={() => {
          addItem({ id, title, priceLabel, href });
          window.location.href = '/cart';
        }}
        className="min-h-11 bg-accent-primary px-5 text-sm font-semibold tracking-wide text-white uppercase transition-base hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      >
        Dodaj do koszyka
      </button>
      <p className="text-xs text-text-muted">
        Dodanie jest lokalne — bez płatności i bez złożenia zamówienia.
      </p>
    </div>
  );
}
