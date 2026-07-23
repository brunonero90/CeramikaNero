'use client';

import { useActionState } from 'react';
import type { MediaUploadActionState } from './actions';

export function UploadMediaForm({
  action,
}: {
  action: (
    prevState: MediaUploadActionState | undefined,
    formData: FormData
  ) => Promise<MediaUploadActionState>;
}) {
  const [state, dispatch, isPending] = useActionState<
    MediaUploadActionState | undefined,
    FormData
  >(action, undefined);

  return (
    <form action={dispatch} className="max-w-2xl space-y-4">
      {state?.ok && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-700"
          role="status"
        >
          {state.message}
        </p>
      )}
      {!state?.ok && state?.error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="file" className="block text-sm font-medium">
          Plik (JPG, PNG, WebP, AVIF, max 10 MB)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          required
          className="mt-1 block w-full"
        />
      </div>
      <div>
        <label htmlFor="altText" className="block text-sm font-medium">
          Tekst alternatywny
        </label>
        <input
          id="altText"
          name="altText"
          type="text"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Przesyłanie…' : 'Prześlij plik'}
      </button>
    </form>
  );
}
