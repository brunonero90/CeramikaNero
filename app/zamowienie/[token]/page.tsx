import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrderStatusByPublicToken } from '@/lib/cart/order-status';
import { reconcileOrderCheckoutFromSession } from '@/lib/cart/reconcile-order-checkout';
import { formatGroszAsPln } from '@/lib/utils/money';
import { getPublicSettings } from '@/lib/database/services/site-settings';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';
import { OrderStatusClient } from '@/components/clone/order-status-client';
import {
  formatBankAccountForDisplay,
  loadBankTransferConfig,
  buildTransferTitle,
} from '@/lib/payments/bank-transfer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Status zamówienia | Ceramika Nero',
  robots: { index: false, follow: false },
};

function humanPaymentStatus(status: string): string {
  switch (status) {
    case 'paid':
      return 'Opłacone';
    case 'pending':
      return 'Oczekuje na płatność';
    case 'failed':
      return 'Płatność nieudana';
    case 'cancelled':
      return 'Anulowane';
    case 'refunded':
      return 'Zwrócone';
    case 'partially_refunded':
      return 'Częściowo zwrócone';
    default:
      return 'W trakcie';
  }
}

function humanOrderStatus(status: string): string {
  switch (status) {
    case 'awaiting_payment':
      return 'Oczekuje na płatność';
    case 'confirmed':
      return 'Potwierdzone';
    case 'cancelled':
      return 'Anulowane';
    case 'expired':
      return 'Wygasłe';
    case 'refunded':
      return 'Zwrócone';
    case 'partially_refunded':
      return 'Częściowo zwrócone';
    default:
      return 'W trakcie';
  }
}

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const checkoutSessionId = query.session_id?.trim() || null;

  // Stripe return: verify Checkout Session with Stripe API (not browser-trusted).
  if (checkoutSessionId && query.checkout === 'success') {
    try {
      await reconcileOrderCheckoutFromSession({
        publicLookupToken: token,
        checkoutSessionId,
      });
    } catch (err) {
      console.error('order page return reconcile failed', err);
    }
  }

  const order = await getOrderStatusByPublicToken(token);
  if (!order) notFound();

  let contact;
  try {
    contact = contactDisplayFromSettings(await getPublicSettings());
  } catch {
    contact = contactDisplayFromSettings(null);
  }

  const showFinalTotal = !order.shippingQuoteRequired;
  const checkoutFlag = query.checkout ?? null;

  const showBankTransfer =
    !order.shippingQuoteRequired &&
    order.paymentStatus === 'pending' &&
    !order.paymentReconciling &&
    order.selectedPaymentMethod !== 'stripe';

  let bankBlock: {
    recipient: string;
    account: string;
    title: string;
    bankName: string | null;
    deadlineNote: string | null;
  } | null = null;

  if (showBankTransfer) {
    const bank = await loadBankTransferConfig();
    if (bank.ok) {
      bankBlock = {
        recipient: bank.config.recipient,
        account: formatBankAccountForDisplay(bank.config.accountNumber),
        title: buildTransferTitle(
          bank.config.titleTemplate,
          order.orderReference
        ),
        bankName: bank.config.bankName,
        deadlineNote: bank.config.deadlineNote,
      };
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <OrderStatusClient
        initialOrder={order}
        publicLookupToken={token}
        checkoutFlag={checkoutFlag}
        checkoutSessionId={checkoutSessionId}
      />

      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Status zamówienia</dt>
          <dd className="font-medium">{humanOrderStatus(order.status)}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Płatność</dt>
          <dd className="font-medium">
            {humanPaymentStatus(order.paymentStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Realizacja</dt>
          <dd className="font-medium">
            {order.fulfillmentStatus === 'fulfilled'
              ? order.fulfillmentMethod === 'shipping'
                ? 'Wysłano'
                : 'Gotowe / odebrane'
              : order.fulfillmentMethod === 'shipping'
                ? 'Wysyłka'
                : order.fulfillmentMethod === 'pickup'
                  ? 'Odbiór osobisty'
                  : 'W przygotowaniu'}
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
                {formatGroszAsPln(item.lineTotalGrossGrosz)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex justify-between text-sm">
          <span>Suma pozycji</span>
          <span className="font-semibold">
            {formatGroszAsPln(order.subtotalGrossGrosz)}
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
                <span>{formatGroszAsPln(order.shippingGrossGrosz)}</span>
              </p>
            ) : null}
            {showFinalTotal ? (
              <p className="mt-3 flex justify-between text-base font-semibold">
                <span>Do zapłaty</span>
                <span>{formatGroszAsPln(order.totalGrossGrosz)}</span>
              </p>
            ) : null}
          </>
        )}
      </section>

      {bankBlock ? (
        <section className="mt-6 space-y-2 rounded border border-surface-subtle bg-white/70 p-4 text-sm">
          <h2 className="font-heading text-lg font-semibold">
            Przelew bankowy
          </h2>
          <p>
            <span className="text-text-muted">Do zapłaty: </span>
            <strong>{formatGroszAsPln(order.totalGrossGrosz)}</strong>
          </p>
          <p>
            <span className="text-text-muted">Odbiorca: </span>
            <strong>{bankBlock.recipient}</strong>
          </p>
          <p>
            <span className="text-text-muted">Numer konta: </span>
            <strong className="tracking-wide">{bankBlock.account}</strong>
          </p>
          {bankBlock.bankName ? (
            <p>
              <span className="text-text-muted">Bank: </span>
              {bankBlock.bankName}
            </p>
          ) : null}
          <p>
            <span className="text-text-muted">Tytuł przelewu: </span>
            <strong>{bankBlock.title}</strong>
          </p>
          <p className="text-text-muted">
            Rezerwacja pozostaje nieopłacona do momentu zaksięgowania przelewu.
          </p>
          {bankBlock.deadlineNote ? (
            <p className="text-text-muted">{bankBlock.deadlineNote}</p>
          ) : null}
        </section>
      ) : null}

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
