'use client';

import Link from 'next/link';
import { CloneCta } from '@/components/clone/marketing';
import { useLocalCart } from '@/components/clone/local-cart';

export function CartPageClient() {
  const { items, clear } = useLocalCart();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        Koszyk
      </h1>
      <p className="mt-3 text-sm text-text-muted">
        Koszyk lokalny — bez płatności online, bez Stripe i bez zapisu zamówień
        w tej fazie klonu.
      </p>
      {items.length === 0 ? (
        <p className="mt-8 text-text-muted">Koszyk jest pusty.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item, index) => (
            <li
              key={`${item.id}-${index}`}
              className="flex items-center justify-between border border-surface-subtle/40 bg-surface-raised p-4"
            >
              <div>
                <Link
                  href={item.href}
                  className="font-semibold text-text-primary underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-sm text-text-muted">{item.priceLabel}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <CloneCta href="/sklep">Wróć do sklepu</CloneCta>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="min-h-11 border border-surface-subtle px-5 text-sm font-semibold tracking-wide text-text-muted uppercase"
          >
            Wyczyść koszyk
          </button>
        ) : null}
      </div>
      <p className="mt-6 text-xs text-text-muted">
        Finalizacja zakupu nie jest dostępna. Żadne środki nie są pobierane.
      </p>
    </div>
  );
}
