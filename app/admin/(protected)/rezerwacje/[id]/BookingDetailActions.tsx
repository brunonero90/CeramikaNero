'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelBookingAction,
  confirmManualPaymentAction,
  refundBookingAction,
  retryEmailAction,
  moveBookingAction,
} from '../actions';

type Props = {
  bookingId: string;
  bookingStatus: string;
  paymentStatus?: string;
};

export function BookingDetailActions({
  bookingId,
  bookingStatus,
  paymentStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const active =
    bookingStatus === 'pending' ||
    bookingStatus === 'awaiting_payment' ||
    bookingStatus === 'confirmed';
  const canConfirm =
    paymentStatus === 'pending' && bookingStatus !== 'cancelled';
  const canRefund =
    (paymentStatus === 'paid' || paymentStatus === 'partially_refunded') &&
    bookingStatus !== 'cancelled';

  function handleConfirmPayment() {
    startTransition(async () => {
      await confirmManualPaymentAction(bookingId);
      router.refresh();
    });
  }

  function handleCancel() {
    const reason = window.prompt('Podaj powód anulacji:');
    if (!reason) return;
    startTransition(async () => {
      await cancelBookingAction(bookingId, reason);
      router.refresh();
    });
  }

  function handleRefund() {
    const amount = window.prompt(
      'Kwota zwrotu w groszach (np. 10000 dla 100,00 PLN):'
    );
    const reason = window.prompt('Powód zwrotu:');
    if (!amount || !reason) return;
    startTransition(async () => {
      await refundBookingAction(bookingId, {
        amountGrossGrosz: Number(amount),
        reason,
      });
      router.refresh();
    });
  }

  function handleMove() {
    const sessionId = window.prompt('ID docelowej sesji:');
    if (!sessionId) return;
    startTransition(async () => {
      await moveBookingAction(bookingId, sessionId);
      router.refresh();
    });
  }

  function handleRetryEmail(type: 'confirmation' | 'cancellation' | 'refund') {
    startTransition(async () => {
      await retryEmailAction(bookingId, type);
      router.refresh();
    });
  }

  const btn =
    'rounded-md bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-50';

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirm && (
        <button
          onClick={handleConfirmPayment}
          disabled={isPending}
          className={btn}
        >
          Potwierdź płatność
        </button>
      )}
      {active && (
        <button onClick={handleCancel} disabled={isPending} className={btn}>
          Anuluj
        </button>
      )}
      {canRefund && (
        <button onClick={handleRefund} disabled={isPending} className={btn}>
          Zwrot
        </button>
      )}
      {active && (
        <button onClick={handleMove} disabled={isPending} className={btn}>
          Przenieś
        </button>
      )}
      <button
        onClick={() => handleRetryEmail('confirmation')}
        disabled={isPending}
        className={btn}
      >
        Wyślij potwierdzenie
      </button>
    </div>
  );
}
