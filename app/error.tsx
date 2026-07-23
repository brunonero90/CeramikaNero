'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h2 className="font-heading text-3xl font-semibold text-text-primary">
        Coś poszło nie tak
      </h2>
      <p className="mt-2 max-w-md text-text-muted">
        Przepraszamy, wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć na
        stronę główną.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} variant="primary">
          Spróbuj ponownie
        </Button>
        <Button href="/" variant="outline">
          Strona główna
        </Button>
      </div>
    </div>
  );
}
