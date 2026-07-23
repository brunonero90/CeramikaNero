'use client';

import { useActionState } from 'react';
import { resetPasswordAction, type ResetPasswordActionState } from './actions';

export function ResetPasswordForm() {
  const [state, dispatch, isPending] = useActionState<
    ResetPasswordActionState | undefined,
    FormData
  >(resetPasswordAction, undefined);

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Nowe hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium">
          Potwierdź nowe hasło
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
        />
      </div>
      {state && !state.ok && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-green-700" role="status">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Zapisywanie…' : 'Zresetuj hasło'}
      </button>
    </form>
  );
}
