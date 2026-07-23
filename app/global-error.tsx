'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="pl">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#faf7f2] px-4 py-24 text-center text-[#3e2723]">
        <h2 className="text-3xl font-semibold">Coś poszło nie tak</h2>
        <p className="mt-2 max-w-md">
          Przepraszamy, wystąpił krytyczny błąd aplikacji. Spróbuj ponownie.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 rounded-md bg-[#c67b5c] px-6 py-3 text-base font-medium text-white shadow-md transition hover:bg-[#c67b5c]/90"
        >
          Spróbuj ponownie
        </button>
      </body>
    </html>
  );
}
