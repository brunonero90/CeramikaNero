'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { duplicateSessionAction } from '../actions';

export function SessionOps({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border bg-white p-4 text-sm">
      <button
        type="button"
        disabled={isPending}
        className="rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        onClick={() => {
          setError(null);
          setMessage(null);
          startTransition(async () => {
            const result = await duplicateSessionAction(sessionId);
            if (!result.ok) {
              setError(result.formError ?? 'Nie udało się zduplikować.');
              return;
            }
            setMessage(result.message);
            router.push(`/admin/terminy/${result.id}`);
          });
        }}
      >
        {isPending ? 'Duplikowanie…' : 'Duplikuj na +7 dni (szkic)'}
      </button>
      <a
        href={`/admin/terminy/${sessionId}/roster.csv`}
        className="rounded border px-3 py-2 hover:bg-gray-50"
      >
        Eksport listy uczestników (CSV)
      </a>
      {error ? <p className="w-full text-red-700">{error}</p> : null}
      {message ? <p className="w-full text-green-700">{message}</p> : null}
    </div>
  );
}
