'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useLocalCart } from '@/components/clone/local-cart';
import {
  revalidateCartLines,
  type RevalidatedCart,
} from '@/lib/cart/revalidate';
import { formatPrice } from '@/lib/utils/price';

function formatSession(startsAt: string, timezone: string): string {
  if (!startsAt) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: timezone || 'Europe/Warsaw',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(startsAt));
}

export function CartPageClient() {
  const { lines, setQuantity, removeLine, clear, ready } = useLocalCart();
  const [validated, setValidated] = useState<RevalidatedCart | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fingerprint = lines.map((l) => `${l.key}:${l.quantity}`).join('|');

  useEffect(() => {
    if (!ready) return;
    startTransition(async () => {
      setError(null);
      try {
        const result = await revalidateCartLines(lines);
        setValidated(result);
      } catch {
        setError('Nie udało się sprawdzić dostępności koszyka.');
      }
    });
  }, [ready, fingerprint]); // eslint-disable-line react-hooks/exhaustive-deps -- fingerprint tracks line changes

  const display = validated?.lines ?? [];
  const empty = ready && lines.length === 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        Koszyk
      </h1>
      <p className="mt-2 text-sm text-text-muted">
        Dostępność i ceny sprawdzamy ponownie przed złożeniem zamówienia.
        Rezerwacja miejsca następuje dopiero po potwierdzeniu zamówienia — nie
        przy dodaniu do koszyka.
      </p>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {empty ? (
        <div className="mt-10 space-y-4 text-center">
          <p className="text-text-muted">Twój koszyk jest pusty.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Wybierz warsztat
            </Link>
            <Link
              href="/home"
              className="inline-flex border border-surface-subtle px-4 py-2 text-sm font-semibold text-text-primary"
            >
              Glina Box
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {isPending && !validated ? (
            <p className="text-sm text-text-muted">Sprawdzanie dostępności…</p>
          ) : null}
          <ul className="space-y-3">
            {(display.length ? display : lines).map((line) => {
              const issues =
                'issues' in line && Array.isArray(line.issues)
                  ? line.issues
                  : [];
              const unit = Number(
                'unitPriceGrosz' in line
                  ? line.unitPriceGrosz
                  : line.unitPriceHintGrosz
              );
              return (
                <li
                  key={line.key}
                  className="border border-surface-subtle bg-surface-raised p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-text-primary">
                        {line.type === 'workshop_session'
                          ? line.workshopTitle
                          : line.title}
                      </p>
                      {line.type === 'workshop_session' ? (
                        <p className="mt-1 text-sm text-text-muted">
                          {formatSession(line.startsAt, line.timezone)}
                          {line.locationName ? ` · ${line.locationName}` : ''}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-text-muted">
                          {line.fulfillment === 'shipping'
                            ? 'Wysyłka do domu'
                            : 'Odbiór w pracowni'}
                        </p>
                      )}
                      {issues.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm text-amber-800">
                          {issues.map((issue) => (
                            <li key={issue}>{issue}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-sm text-text-muted">
                        Ilość{' '}
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={line.quantity}
                          onChange={(e) =>
                            setQuantity(line.key, Number(e.target.value) || 1)
                          }
                          className="ml-1 w-16 border border-surface-subtle px-2 py-1"
                        />
                      </label>
                      <span className="font-semibold text-text-primary">
                        {formatPrice(unit * line.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="text-sm text-text-muted underline"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-3 border-t border-surface-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg font-semibold text-text-primary">
              Razem:{' '}
              {formatPrice(
                validated?.subtotalGrosz ??
                  lines.reduce(
                    (s, l) => s + l.unitPriceHintGrosz * l.quantity,
                    0
                  )
              )}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => clear()}
                className="border border-surface-subtle px-4 py-2 text-sm"
              >
                Wyczyść koszyk
              </button>
              {validated && !validated.canCheckout ? (
                <span className="inline-flex bg-gray-400 px-4 py-2 text-sm font-semibold text-white">
                  Popraw niedostępne pozycje
                </span>
              ) : (
                <Link
                  href="/cart/checkout"
                  className="inline-flex bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Przejdź do zamówienia
                </Link>
              )}
            </div>
          </div>
          {validated?.shippingQuoteRequired ? (
            <p className="text-sm text-amber-900">
              Koszyk zawiera wysyłkę — koszt dostawy zostanie potwierdzony przed
              płatnością (nie doliczamy sztucznej kwoty).
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
