'use client';

import { useId, useState } from 'react';
import { siteContact } from '@/lib/fixtures/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * Local-only newsletter UI. Does not call external services.
 * Submits are acknowledged in-place without claiming delivery.
 */
export function NewsletterSignup({
  variant = 'default',
}: {
  variant?: 'default' | 'wix-panel';
}) {
  const id = useId();
  const [status, setStatus] = useState<'idle' | 'local-ack'>('idle');
  const wix = variant === 'wix-panel';

  return (
    <form
      className={cn('mx-auto w-full', wix ? 'max-w-3xl' : 'max-w-xl')}
      onSubmit={(event) => {
        event.preventDefault();
        setStatus('local-ack');
      }}
      noValidate
    >
      <p
        className={cn(
          'text-center',
          wix
            ? 'font-heading text-[20px] font-normal text-[#fdf2ed] md:text-[22px]'
            : 'font-heading text-lg text-white md:text-xl'
        )}
      >
        Zapisz się do Newslettera
      </p>
      <div
        className={cn(
          'mt-4 flex flex-col gap-3',
          wix ? 'md:flex-row md:items-center md:gap-3' : 'sm:flex-row'
        )}
      >
        {wix ? (
          <button
            type="submit"
            className="h-9 shrink-0 border border-[#5c4038] bg-[#f6d5c8] px-3 text-[13px] font-medium text-[#5c4038] transition-base hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Zapisz się teraz
          </button>
        ) : null}
        <label className="sr-only" htmlFor={`${id}-email`}>
          Adres e-mail
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={wix ? 'Wpisz swój e-mail' : 'Twój e-mail'}
          className={cn(
            'flex-1 border-0 bg-white px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
            wix ? 'h-9' : 'min-h-10'
          )}
        />
        {!wix ? (
          <button
            type="submit"
            className="min-h-11 bg-white px-5 text-sm font-semibold tracking-wide text-accent-primary uppercase transition-base hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Zapisz się teraz
          </button>
        ) : null}
        {wix ? (
          <label className="flex shrink-0 items-center gap-2 text-[11px] leading-snug text-[#fdf2ed] md:max-w-[200px]">
            <input
              type="checkbox"
              name="consent"
              className="shrink-0"
              required
            />
            <span>
              Akceptuję regulamin{' '}
              <a
                href={siteContact.privacyHref}
                className="underline underline-offset-2"
              >
                Zobacz warunki
              </a>
            </span>
          </label>
        ) : null}
      </div>
      {!wix ? (
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
            Nero. Administratorem Twoich danych osobowych będzie Małgorzata
            Nero, prowadząca jednoosobową działalność gospodarczą pod nazwą
            Pracownia ceramiki Nero Małgorzata Nero z siedzibą w Suchym Lesie
            (62-002), ul. Podgórna 3, posługującą się numerem NIP{' '}
            {siteContact.nip}.
          </span>
        </label>
      ) : (
        <p className="mt-4 text-left text-[10px] leading-relaxed text-[#fdf2ed]/90 md:text-[11px]">
          Zapisując się do newslettera, wyrażasz zgodę na przesyłanie Ci
          informacji o nowościach, promocjach i produktach w sklepie Ceramika
          Nero. Administratorem Twoich danych osobowych będzie Małgorzata Nero,
          prowadząca jednoosobową działalność gospodarczą pod nazwą Pracownia
          ceramiki Nero Małorzata Nero z siedzibą w Suchym Lesie (62-002), ul.
          Podgórna 3, posługującą się numerem NIP {siteContact.nip}. Szczegóły
          związane z przetwarzaniem danych znajdziesz w polityce prywatności.
        </p>
      )}
      {status === 'local-ack' && (
        <p className="mt-3 text-sm text-white" role="status">
          Formularz lokalny — zapis newslettera nie jest jeszcze połączony z
          usługą wysyłki. Dane nie zostały wysłane.
        </p>
      )}
    </form>
  );
}
