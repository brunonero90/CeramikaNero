'use client';

import { useActionState, useEffect, useRef } from 'react';
import { loginAction, type LoginActionState } from './actions';

export function LoginForm() {
  const navigated = useRef(false);
  const [state, dispatch, isPending] = useActionState<
    LoginActionState | undefined,
    FormData
  >(loginAction, undefined);

  useEffect(() => {
    if (!state?.ok || !state.redirectTo || navigated.current) return;
    navigated.current = true;
    // Hard navigation: soft router.replace after a Server Action often stalls
    // (or bounces) before the new auth cookies are visible to /admin.
    window.location.assign(state.redirectTo);
  }, [state]);

  return (
    <form action={dispatch} className="space-y-4" noValidate>
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
          disabled={isPending || state?.ok === true}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-60"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending || state?.ok === true}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-60"
        />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-emerald-700" role="status">
          Zalogowano. Przekierowanie do panelu…
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending || state?.ok === true}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending
          ? 'Logowanie…'
          : state?.ok
            ? 'Przekierowanie…'
            : 'Zaloguj się'}
      </button>
    </form>
  );
}
