'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomerOrderStatus } from '@/lib/cart/customer-order-status';
import { refreshOrderStatusByToken } from '@/lib/cart/refresh-order-status-action';
import { OrderPayButton } from '@/components/clone/order-pay-button';

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 30_000;

export function orderLifecycleCopy(order: {
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  fulfillmentMethod: string;
  shippingQuoteRequired: boolean;
  selectedPaymentMethod?: string | null;
  paymentReconciling?: boolean;
  trackingReference?: string | null;
  checkoutFlag?: string | null;
}): { title: string; body: string } {
  if (
    order.paymentReconciling ||
    (order.checkoutFlag === 'success' && order.paymentStatus !== 'paid')
  ) {
    return {
      title: 'Dziękujemy! Stripe przyjął płatność',
      body: 'Czekamy jeszcze na jej końcowe potwierdzenie — zwykle trwa to tylko chwilę.',
    };
  }
  if (order.paymentStatus === 'paid') {
    return {
      title: 'Płatność potwierdzona',
      body: 'Dziękujemy — Twoje zamówienie i miejsce na warsztatach są potwierdzone. Teraz możesz już spokojnie czekać na spotkanie w Ceramika Nero.',
    };
  }
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
    if (order.selectedPaymentMethod === 'stripe') {
      return {
        title: 'Oczekujemy na płatność online',
        body: 'Możesz dokończyć bezpieczną płatność poniżej. Potwierdzenie pojawi się dopiero po weryfikacji przez operatora płatności.',
      };
    }
    return {
      title: 'Oczekujemy na płatność',
      body: 'Kwota jest ustalona. Wykonaj przelew według danych poniżej — rezerwacja pozostaje nieopłacona do momentu zaksięgowania.',
    };
  }
  if (order.paymentStatus === 'failed') {
    return {
      title: 'Płatność nieudana lub wygasła',
      body: 'Możesz spróbować ponownie zapłacić online albo skontaktować się z pracownią.',
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

function preferFresherOrder(
  serverOrder: CustomerOrderStatus,
  polledOrder: CustomerOrderStatus | null
): CustomerOrderStatus {
  if (!polledOrder) return serverOrder;
  if (serverOrder.paymentStatus === 'paid') return serverOrder;
  if (polledOrder.paymentStatus === 'paid') return polledOrder;
  if (polledOrder.paymentReconciling) return polledOrder;
  return serverOrder;
}

export function OrderStatusClient({
  initialOrder,
  publicLookupToken,
  checkoutFlag,
  checkoutSessionId = null,
}: {
  initialOrder: CustomerOrderStatus;
  publicLookupToken: string;
  checkoutFlag: string | null;
  checkoutSessionId?: string | null;
}) {
  const router = useRouter();
  const [polledOrder, setPolledOrder] = useState<CustomerOrderStatus | null>(
    null
  );
  const order = preferFresherOrder(initialOrder, polledOrder);

  useEffect(() => {
    if (checkoutFlag !== 'success') return;
    if (initialOrder.paymentStatus === 'paid') return;

    const started = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (Date.now() - started > POLL_MAX_MS) return;

      try {
        const next = await refreshOrderStatusByToken(
          publicLookupToken,
          checkoutSessionId
        );
        if (cancelled || !next) return;
        setPolledOrder(next);
        router.refresh();
        if (next.paymentStatus === 'paid') return;
      } catch {
        // Keep polling until max window.
      }

      if (!cancelled && Date.now() - started <= POLL_MAX_MS) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    // Immediate first attempt — webhook may lag; Stripe API reconcile uses session_id.
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [
    checkoutFlag,
    checkoutSessionId,
    initialOrder.paymentStatus,
    publicLookupToken,
    router,
  ]);

  const copy = orderLifecycleCopy({
    ...order,
    checkoutFlag,
  });

  const showPayButton =
    order.canStartStripePayment &&
    !order.paymentReconciling &&
    !(checkoutFlag === 'success' && order.paymentStatus !== 'paid');

  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold text-text-primary">
        {copy.title}
      </h1>
      <p className="mt-3 text-text-muted">
        Numer:{' '}
        <strong className="text-text-primary">{order.orderReference}</strong>
      </p>
      <p className="mt-2 text-sm text-text-muted">{copy.body}</p>

      {showPayButton ? (
        <OrderPayButton publicLookupToken={publicLookupToken} />
      ) : null}
    </div>
  );
}
