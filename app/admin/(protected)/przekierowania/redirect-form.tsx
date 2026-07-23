'use client';

import { useActionState } from 'react';
import type { RedirectActionState } from './actions';

type RedirectFormData = {
  sourcePath: string;
  destinationPath: string;
  statusCode: 301 | 308;
};

export function RedirectForm({
  action,
  initialData,
  submitLabel,
}: {
  action: (
    prevState: RedirectActionState | undefined,
    formData: FormData
  ) => Promise<RedirectActionState>;
  initialData?: RedirectFormData;
  submitLabel: string;
}) {
  const [state, dispatch, isPending] = useActionState<
    RedirectActionState | undefined,
    FormData
  >(action, undefined);

  const defaultData: RedirectFormData = {
    sourcePath: '',
    destinationPath: '',
    statusCode: 301,
    ...initialData,
  };

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
      {!state?.ok && state?.formError && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {state.formError}
        </p>
      )}
      <div>
        <label htmlFor="sourcePath" className="block text-sm font-medium">
          Ścieżka źródłowa
        </label>
        <input
          id="sourcePath"
          name="sourcePath"
          type="text"
          defaultValue={defaultData.sourcePath}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {state && !state.ok && state.errors?.sourcePath && (
          <p className="mt-1 text-sm text-red-600">{state.errors.sourcePath}</p>
        )}
      </div>
      <div>
        <label htmlFor="destinationPath" className="block text-sm font-medium">
          Ścieżka docelowa
        </label>
        <input
          id="destinationPath"
          name="destinationPath"
          type="text"
          defaultValue={defaultData.destinationPath}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
        {state && !state.ok && state.errors?.destinationPath && (
          <p className="mt-1 text-sm text-red-600">
            {state.errors.destinationPath}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="statusCode" className="block text-sm font-medium">
          Kod przekierowania
        </label>
        <select
          id="statusCode"
          name="statusCode"
          defaultValue={defaultData.statusCode}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        >
          <option value={301}>301 - Stałe</option>
          <option value={308}>308 - Stałe (zachowaj metodę)</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Zapisywanie…' : submitLabel}
      </button>
    </form>
  );
}
