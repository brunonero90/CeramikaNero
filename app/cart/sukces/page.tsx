import type { Metadata } from 'next';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Zamówienie złożone | Ceramika Nero',
  robots: { index: false, follow: false },
};

export default async function CartSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    reference?: string;
    bookings?: string;
    total?: string;
    shipping_quote?: string;
  }>;
}) {
  const sp = await searchParams;
  const reference = sp.reference ?? '—';
  const bookings = (sp.bookings ?? '')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  const total = Number(sp.total ?? 0);
  const shippingQuote = sp.shipping_quote === '1';

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        Dziękujemy — zamówienie przyjęte
      </h1>
      <p className="mt-4 text-text-muted">
        Numer zamówienia:{' '}
        <strong className="text-text-primary">{reference}</strong>
      </p>
      {bookings.length > 0 ? (
        <p className="mt-2 text-text-muted">
          Numery rezerwacji warsztatów:{' '}
          <strong className="text-text-primary">{bookings.join(', ')}</strong>
        </p>
      ) : null}
      {total > 0 ? (
        <p className="mt-2 text-text-muted">
          Kwota pozycji: <strong>{formatPrice(total)}</strong>
        </p>
      ) : null}
      {shippingQuote ? (
        <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Koszt wysyłki zostanie potwierdzony osobno przed finalną płatnością.
        </p>
      ) : null}
      <p className="mt-6 text-sm leading-relaxed text-text-muted">
        Status płatności: oczekuje na przelew / potwierdzenie studia. Płatność
        kartą nie jest jeszcze aktywna. Szczegóły prześlemy na podany e-mail
        (jeśli wysyłka e-mail jest skonfigurowana) lub skontaktujemy się
        bezpośrednio.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/"
          className="inline-flex bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Wróć na stronę główną
        </Link>
        <Link href="/kontakt" className="inline-flex border px-4 py-2 text-sm">
          Kontakt
        </Link>
      </div>
    </main>
  );
}
