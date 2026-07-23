'use client';

import { useActionState } from 'react';
import {
  forgotPasswordAction,
  type ForgotPasswordActionState,
} from './actions';

export function ForgotPasswordForm() {
  const [state, dispatch, isPending] = useActionState<
    ForgotPasswordActionState | undefined,
    FormData
  >(forgotPasswordAction, undefined);

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
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
        {isPending ? 'Wysyłanie…' : 'Wyślij link resetujący'}
      </button>
    </form>
  );
}
