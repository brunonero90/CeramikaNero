'use client';

import { useState, useTransition } from 'react';
import { startOrderStripePayment } from '@/lib/cart/order-pay-action';

export function OrderPayButton({
  publicLookupToken,
}: {
  publicLookupToken: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center bg-accent-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await startOrderStripePayment(publicLookupToken);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            window.location.assign(result.checkoutUrl);
          });
        }}
      >
        {pending ? 'Przygotowujemy płatność…' : 'Zapłać online'}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
