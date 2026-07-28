'use client';

import { useState, useTransition } from 'react';
import { startOrderStripePayment } from '@/lib/cart/order-pay-action';

export function OrderPayButton({
  publicLookupToken,
}: {
  publicLookupToken: string;
}) {
  const [message, setMessage] = useState<{
    text: string;
    tone: 'error' | 'info';
  } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center bg-accent-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await startOrderStripePayment(publicLookupToken);
            if (!result.ok) {
              const isReconciling = /potwierdzenie/i.test(result.error);
              setMessage({
                text: result.error,
                tone: isReconciling ? 'info' : 'error',
              });
              if (isReconciling) {
                window.setTimeout(() => {
                  window.location.reload();
                }, 2000);
              }
              return;
            }
            window.location.assign(result.checkoutUrl);
          });
        }}
      >
        {pending ? 'Przygotowujemy płatność…' : 'Zapłać online'}
      </button>
      {message ? (
        <p
          className={
            message.tone === 'info'
              ? 'mt-2 text-sm text-sky-800'
              : 'mt-2 text-sm text-red-700'
          }
          role={message.tone === 'info' ? 'status' : 'alert'}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
