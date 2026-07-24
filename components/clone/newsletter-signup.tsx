'use client';

import { useId, useState } from 'react';
import { siteContact } from '@/lib/fixtures/navigation';

/**
 * Local-only newsletter UI. Does not call external services.
 * Submits are acknowledged in-place without claiming delivery.
 */
export function NewsletterSignup() {
  const id = useId();
  const [status, setStatus] = useState<'idle' | 'local-ack'>('idle');

  return (
    <form
      className="mx-auto w-full max-w-xl"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus('local-ack');
      }}
      noValidate
    >
      <p className="font-heading text-lg text-white md:text-xl">
        Zapisz się do Newslettera
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor={`${id}-email`}>
          Adres e-mail
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Twój e-mail"
          className="min-h-11 flex-1 border border-white/40 bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        />
        <button
          type="submit"
          className="min-h-11 bg-white px-5 text-sm font-semibold tracking-wide text-accent-primary uppercase transition-base hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Zapisz się teraz
        </button>
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-white/85">
        <input type="checkbox" name="consent" className="mt-1" required />
        <span>
          Akceptuję regulamin.{' '}
          <a
            href={siteContact.privacyHref}
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Zobacz warunki
          </a>
          . Zapisując się do newslettera, wyrażasz zgodę na przesyłanie Ci
          informacji o nowościach, promocjach i produktach w sklepie Ceramika
          Nero. Administratorem Twoich danych osobowych będzie Małgorzata Nero,
          prowadząca jednoosobową działalność gospodarczą pod nazwą Pracownia
          ceramiki Nero Małgorzata Nero z siedzibą w Suchym Lesie (62-002), ul.
          Podgórna 3, posługującą się numerem NIP {siteContact.nip}.
        </span>
      </label>
      {status === 'local-ack' && (
        <p className="mt-3 text-sm text-white" role="status">
          Formularz lokalny — zapis newslettera nie jest jeszcze połączony z
          usługą wysyłki. Dane nie zostały wysłane.
        </p>
      )}
    </form>
  );
}
