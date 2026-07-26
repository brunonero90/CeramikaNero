'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useLocalCart } from '@/components/clone/local-cart';
import { submitCartOrder } from '@/lib/cart/checkout';
import {
  revalidateCartLines,
  type RevalidatedCart,
} from '@/lib/cart/revalidate';
import { formatPrice } from '@/lib/utils/price';

type Participant = {
  display_name: string;
  age: string;
  participant_type: 'adult' | 'child' | 'unspecified';
};

export function CheckoutPageClient() {
  const router = useRouter();
  const { lines, clear, ready } = useLocalCart();
  const [validated, setValidated] = useState<RevalidatedCart | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [participantsBySession, setParticipantsBySession] = useState<
    Record<string, Participant[]>
  >({});

  const [recipientName, setRecipientName] = useState('');
  const [street, setStreet] = useState('');
  const [street2, setStreet2] = useState('');
  const [postal, setPostal] = useState('');
  const [city, setCity] = useState('');

  const needsShipping = useMemo(
    () =>
      (validated?.lines ?? lines).some(
        (l) =>
          (l.type === 'physical_product' || l.type === 'studio_service') &&
          l.fulfillment === 'shipping' &&
          ('requiresShipping' in l ? l.requiresShipping : true)
      ),
    [validated, lines]
  );

  useEffect(() => {
    if (!ready) return;
    startTransition(async () => {
      const result = await revalidateCartLines(lines);
      setValidated(result);
      const next: Record<string, Participant[]> = {};
      for (const line of result.lines) {
        if (line.type !== 'workshop_session') continue;
        next[line.sessionId] = Array.from({ length: line.quantity }, () => ({
          display_name: '',
          age: '',
          participant_type: 'unspecified',
        }));
      }
      setParticipantsBySession(next);
    });
  }, [ready, lines]);

  function updateParticipant(
    sessionId: string,
    index: number,
    field: keyof Participant,
    value: string
  ) {
    setParticipantsBySession((prev) => {
      const list = [...(prev[sessionId] ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [sessionId]: list };
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validated?.canCheckout) {
      setError('Koszyk zawiera niedostępne pozycje.');
      return;
    }
    if (!terms) {
      setError('Zaakceptuj regulamin i politykę prywatności.');
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await submitCartOrder({
        purchaserFirstName: firstName,
        purchaserLastName: lastName,
        purchaserEmail: email,
        purchaserPhone: phone,
        customerNotes: notes,
        marketingConsent: marketing,
        termsAccepted: true as const,
        privacyPolicyVersion: '1.0',
        participantsBySession,
        shipping: needsShipping
          ? {
              recipient_name: recipientName,
              street_line1: street,
              street_line2: street2 || null,
              postal_code: postal,
              city,
              country: 'PL' as const,
              phone: phone || null,
            }
          : null,
        lines: validated.lines,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      clear();
      const params = new URLSearchParams({
        reference: result.orderReference,
        total: String(result.totalGrossGrosz),
      });
      if (result.bookingReferences.length) {
        params.set('bookings', result.bookingReferences.join(','));
      }
      if (result.shippingQuoteRequired) params.set('shipping_quote', '1');
      router.push(`/cart/sukces?${params.toString()}`);
    });
  }

  if (ready && lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Zamówienie</h1>
        <p className="mt-4 text-text-muted">Koszyk jest pusty.</p>
        <Link href="/cart" className="mt-4 inline-block underline">
          Wróć do koszyka
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="font-heading text-3xl font-semibold">Zamówienie</h1>
      <p className="mt-2 text-sm text-text-muted">
        Płatność kartą nie jest jeszcze aktywna. Składasz zamówienie z
        oczekiwaniem na przelew / potwierdzenie studia.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Dane kupującego</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Imię
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="text-sm">
              Nazwisko
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            E-mail
            <input
              required
              type="email"
              className="mt-1 w-full border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Telefon
            <input
              className="mt-1 w-full border px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        </section>

        {(validated?.lines ?? [])
          .filter((l) => l.type === 'workshop_session')
          .map((line) =>
            line.type === 'workshop_session' ? (
              <section key={line.key} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  Uczestnicy — {line.workshopTitle}
                </h2>
                {(participantsBySession[line.sessionId] ?? []).map((p, idx) => (
                  <div
                    key={`${line.sessionId}-${idx}`}
                    className="grid gap-2 border p-3 sm:grid-cols-2"
                  >
                    <label className="text-sm">
                      Imię / oznaczenie
                      <input
                        className="mt-1 w-full border px-3 py-2"
                        value={p.display_name}
                        onChange={(e) =>
                          updateParticipant(
                            line.sessionId,
                            idx,
                            'display_name',
                            e.target.value
                          )
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Wiek (jeśli wymagany)
                      <input
                        className="mt-1 w-full border px-3 py-2"
                        value={p.age}
                        onChange={(e) =>
                          updateParticipant(
                            line.sessionId,
                            idx,
                            'age',
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </section>
            ) : null
          )}

        {needsShipping ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Adres dostawy</h2>
            <p className="text-sm text-text-muted">
              Wymagany, ponieważ koszyk zawiera produkt z wysyłką do domu.
            </p>
            <label className="block text-sm">
              Odbiorca
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Ulica i numer
              <input
                required
                className="mt-1 w-full border px-3 py-2"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Numer mieszkania (opcjonalnie)
              <input
                className="mt-1 w-full border px-3 py-2"
                value={street2}
                onChange={(e) => setStreet2(e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Kod pocztowy
                <input
                  required
                  className="mt-1 w-full border px-3 py-2"
                  value={postal}
                  onChange={(e) => setPostal(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Miasto
                <input
                  required
                  className="mt-1 w-full border px-3 py-2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
            </div>
            <p className="text-sm text-amber-900">
              Wysyłka na terenie Polski. Koszt dostawy — wycena przed płatnością
              (nie jest doliczany automatycznie).
            </p>
          </section>
        ) : null}

        <label className="block text-sm">
          Uwagi
          <textarea
            className="mt-1 w-full border px-3 py-2"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
            required
          />
          <span>
            Akceptuję{' '}
            <Link href="/regulamin" className="underline">
              regulamin
            </Link>{' '}
            i{' '}
            <Link href="/polityka-prywatnosci" className="underline">
              politykę prywatności
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <span>Chcę otrzymywać informacje o warsztatach (opcjonalnie).</span>
        </label>

        <div className="space-y-2 rounded border border-surface-subtle bg-surface-raised p-4 text-sm">
          <p className="flex justify-between gap-3">
            <span>Suma pozycji</span>
            <span className="font-semibold">
              {formatPrice(validated?.subtotalGrosz ?? 0)}
            </span>
          </p>
          {needsShipping ? (
            <>
              <p className="flex justify-between gap-3 text-amber-900">
                <span>Wysyłka</span>
                <span>do potwierdzenia</span>
              </p>
              <p className="text-amber-900">
                Koszt wysyłki zostanie potwierdzony przed płatnością. Kwota do
                zapłaty zostanie potwierdzona po ustaleniu kosztu wysyłki — nie
                przelewaj środków, dopóki nie otrzymasz finalnej kwoty.
              </p>
            </>
          ) : (
            <p className="flex justify-between gap-3 text-base font-semibold">
              <span>Do zapłaty</span>
              <span>{formatPrice(validated?.subtotalGrosz ?? 0)}</span>
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !validated?.canCheckout}
          className="w-full bg-accent-primary px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
        >
          {isPending ? 'Składanie zamówienia…' : 'Złóż zamówienie i rezerwację'}
        </button>
      </form>
    </main>
  );
}
