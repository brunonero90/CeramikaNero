'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { finalizeAdminLoginAction } from './actions';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      setError('Email i hasło są wymagane.');
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });

        if (signInError || !data.user || !data.session) {
          setError('Nieprawidłowy email lub hasło.');
          return;
        }

        const finalized = await finalizeAdminLoginAction({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (!finalized.ok) {
          await supabase.auth.signOut();
          setError(finalized.error);
          return;
        }

        setSuccess(true);
        // Full navigation so middleware/proxy and RSC see fresh cookies.
        window.location.assign(finalized.redirectTo);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (/Missing Supabase public environment/i.test(message)) {
          setError(
            'Konfiguracja logowania jest niekompletna. Skontaktuj się z administratorem strony.'
          );
          return;
        }
        setError('Nie udało się zalogować. Spróbuj ponownie.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
          disabled={isPending || success}
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
          disabled={isPending || success}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-60"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <div className="space-y-2" role="status">
          <p className="text-sm text-emerald-700">
            Zalogowano. Przekierowanie do panelu…
          </p>
          <p className="text-sm">
            {/* Hard navigation fallback after cookie session write */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/admin" className="font-medium text-gray-900 underline">
              Kliknij tutaj, jeśli panel się nie otwiera
            </a>
          </p>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isPending || success}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? 'Logowanie…' : success ? 'Przekierowanie…' : 'Zaloguj się'}
      </button>
    </form>
  );
}
