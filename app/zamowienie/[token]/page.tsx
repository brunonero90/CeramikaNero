import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderStatusByPublicToken } from '@/lib/cart/order-status';
import { formatPrice } from '@/lib/utils/price';
import { getPublicSettings } from '@/lib/database/services/site-settings';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Status zamówienia | Ceramika Nero',
  robots: { index: false, follow: false },
};

function lifecycleCopy(order: {
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: string;
  shippingQuoteRequired: boolean;
  trackingReference?: string | null;
}): { title: string; body: string } {
  if (order.status === 'cancelled') {
    return {
      title: 'Zamówienie anulowane',
      body: 'To zamówienie zostało anulowane. Jeśli potrzebujesz pomocy, napisz do pracowni.',
    };
  }
  if (order.shippingQuoteRequired) {
    return {
      title: 'Oczekujemy na wycenę wysyłki',
      body: 'Przyjęliśmy zamówienie. Koszt wysyłki potwierdzimy przed płatnością — nie przelewaj środków, dopóki nie otrzymasz finalnej kwoty.',
    };
  }
  if (order.paymentStatus === 'pending') {
    return {
      title: 'Oczekujemy na płatność',
      body: 'Kwota jest ustalona. Instrukcje przelewu prześlemy e-mailem lub skontaktujemy się bezpośrednio.',
    };
  }
  if (order.paymentStatus === 'paid' && order.fulfillmentStatus !== 'fulfilled') {
    return {
      title: 'Płatność otrzymana',
      body:
        order.fulfillmentMethod === 'shipping'
          ? 'Przygotowujemy paczkę do wysyłki.'
          : 'Przygotowujemy zamówienie do odbioru w pracowni.',
    };
  }
  if (order.fulfillmentStatus === 'fulfilled') {
    return {
      title:
        order.fulfillmentMethod === 'shipping'
          ? 'Wysłane'
          : 'Gotowe / zrealizowane',
      body:
        order.fulfillmentMethod === 'shipping'
          ? order.trackingReference
            ? `Zamówienie zostało wysłane. Numer przesyłki: ${order.trackingReference}.`
            : 'Zamówienie zostało wysłane.'
          : 'Zamówienie jest gotowe lub zostało odebrane.',
    };
  }
  return {
    title: 'Status zamówienia',
    body: 'Aktualny stan zamówienia widzisz poniżej. W razie pytań skontaktuj się z pracownią.',
  };
}

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderStatusByPublicToken(token);
  if (!order) notFound();

  let contact;
  try {
    contact = contactDisplayFromSettings(await getPublicSettings());
  } catch {
    contact = contactDisplayFromSettings(null);
  }

  const showFinalTotal = !order.shippingQuoteRequired;
  const copy = lifecycleCopy(order);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        {copy.title}
      </h1>
      <p className="mt-3 text-text-muted">
        Numer:{' '}
        <strong className="text-text-primary">{order.orderReference}</strong>
      </p>
      <p className="mt-2 text-sm text-text-muted">{copy.body}</p>

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
            <p>{contact.deliveryQuoteWording}</p>
            <p className="mt-1">
              Kwota do zapłaty nie jest jeszcze ostateczna — nie przelewaj
              środków, dopóki nie otrzymasz potwierdzenia z finalną kwotą.
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
            {order.paymentStatus === 'pending' &&
            contact.bankTransferInstructions ? (
              <p className="mt-3 whitespace-pre-line text-sm text-text-muted">
                {contact.bankTransferInstructions}
              </p>
            ) : order.paymentStatus === 'pending' ? (
              <p className="mt-3 text-sm text-text-muted">
                Płatność: przelew bankowy. Instrukcje prześlemy e-mailem lub
                skontaktujemy się bezpośrednio.
              </p>
            ) : null}
          </>
        )}
      </section>

      <p className="mt-8 text-sm text-text-muted">
        Pytania? Napisz na{' '}
        <a href={`mailto:${contact.email}`} className="underline">
          {contact.email}
        </a>{' '}
        lub zadzwoń:{' '}
        <a href={contact.phoneHref} className="underline">
          {contact.phoneDisplay}
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
