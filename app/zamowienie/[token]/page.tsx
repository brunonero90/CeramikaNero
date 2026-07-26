import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderStatusByPublicToken } from '@/lib/cart/order-status';
import { formatPrice } from '@/lib/utils/price';
import { siteContact } from '@/lib/fixtures/navigation';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Status zamówienia | Ceramika Nero',
  robots: { index: false, follow: false },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderStatusByPublicToken(token);
  if (!order) notFound();

  const showFinalTotal = !order.shippingQuoteRequired;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        Status zamówienia
      </h1>
      <p className="mt-3 text-text-muted">
        Numer:{' '}
        <strong className="text-text-primary">{order.orderReference}</strong>
      </p>

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Status zamówienia</dt>
          <dd className="font-medium">{order.status}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Płatność</dt>
          <dd className="font-medium">{order.paymentStatus}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Realizacja</dt>
          <dd className="font-medium">
            {order.fulfillmentStatus} ({order.fulfillmentMethod})
          </dd>
        </div>
        {order.hasDeliveryAddress ? (
          <div>
            <dt className="text-text-muted">Dostawa</dt>
            <dd className="font-medium">
              Adres przyjęty
              {order.city ? ` · ${order.city}` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      {order.bookingReferences.length > 0 ? (
        <p className="mt-4 text-sm text-text-muted">
          Rezerwacje warsztatów:{' '}
          <strong className="text-text-primary">
            {order.bookingReferences.join(', ')}
          </strong>
        </p>
      ) : null}

      <section className="mt-8">
        <h2 className="font-heading text-xl font-semibold">Pozycje</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((item, idx) => (
            <li
              key={`${item.title}-${idx}`}
              className="flex justify-between gap-3 border-b border-surface-subtle/50 py-2"
            >
              <span>
                {item.title} × {item.quantity}
                {item.fulfillmentMethod && item.fulfillmentMethod !== 'none'
                  ? ` · ${item.fulfillmentMethod === 'shipping' ? 'wysyłka' : 'odbiór'}`
                  : ''}
              </span>
              <span className="font-medium">
                {formatPrice(item.lineTotalGrossGrosz)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between text-sm">
          <span>Suma pozycji</span>
          <span className="font-semibold">
            {formatPrice(order.subtotalGrossGrosz)}
          </span>
        </p>
        {order.shippingQuoteRequired ? (
          <div className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p>Zamówienie zostało przyjęte.</p>
            <p className="mt-1">
              Koszt wysyłki zostanie potwierdzony przed płatnością. Kwota do
              zapłaty nie jest jeszcze ostateczna — nie przelewaj środków,
              dopóki nie otrzymasz potwierdzenia z finalną kwotą.
            </p>
          </div>
        ) : (
          <>
            {order.shippingGrossGrosz > 0 ? (
              <p className="mt-2 flex justify-between text-sm">
                <span>Wysyłka</span>
                <span>{formatPrice(order.shippingGrossGrosz)}</span>
              </p>
            ) : null}
            {showFinalTotal ? (
              <p className="mt-3 flex justify-between text-base font-semibold">
                <span>Do zapłaty</span>
                <span>{formatPrice(order.totalGrossGrosz)}</span>
              </p>
            ) : null}
            {order.paymentStatus === 'pending' ? (
              <p className="mt-3 text-sm text-text-muted">
                Płatność: przelew bankowy po potwierdzeniu kwoty przez
                pracownię. Instrukcje prześlemy e-mailem lub skontaktujemy się
                bezpośrednio.
              </p>
            ) : null}
          </>
        )}
      </section>

      <p className="mt-8 text-sm text-text-muted">
        Pytania? Napisz na{' '}
        <a href={`mailto:${siteContact.email}`} className="underline">
          {siteContact.email}
        </a>{' '}
        lub zadzwoń:{' '}
        <a href={siteContact.phoneHref} className="underline">
          {siteContact.phoneDisplay}
        </a>
        .
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/kontakt"
          className="inline-flex min-h-11 items-center border px-4 py-2 text-sm font-semibold"
        >
          Poproś o pomoc
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Strona główna
        </Link>
      </div>
    </main>
  );
}
