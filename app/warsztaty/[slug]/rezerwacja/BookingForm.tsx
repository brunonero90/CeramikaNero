'use client';

import { useState, useTransition } from 'react';
import { createBookingAndCheckout } from '@/lib/booking/reservation';
import { formatPrice } from '@/lib/utils/price';
import { MAX_PARTICIPANTS_PER_BOOKING } from '@/lib/booking/constants';

export function formatWarsawDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

type Participant = {
  displayName: string;
  age: string;
  participantType: 'adult' | 'child' | 'unspecified';
  accessibilityNotes: string;
};

type Session = {
  id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  reserved_count: number;
  price_gross_grosz: number;
  location_name: string | null;
  location_address: string | null;
};

type Workshop = {
  id: string;
  title: string;
  minimum_age: number | null;
  maximum_age: number | null;
  default_price_gross_grosz: number;
};

type Props = {
  workshop: Workshop;
  sessions: Session[];
  privacyPolicyVersion: string;
};

export function BookingForm({
  workshop,
  sessions,
  privacyPolicyVersion,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(sessions[0].id);
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      displayName: '',
      age: '',
      participantType: 'unspecified',
      accessibilityNotes: '',
    },
  ]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const selectedSession =
    sessions.find((s) => s.id === sessionId) ?? sessions[0];
  const available = Math.min(
    selectedSession.capacity - selectedSession.reserved_count,
    MAX_PARTICIPANTS_PER_BOOKING
  );
  const totalPrice = selectedSession.price_gross_grosz * quantity;

  function updateQuantity(next: number) {
    const safe = Math.max(1, Math.min(next, available));
    setQuantity(safe);
    setParticipants((prev) => {
      const nextParticipants = [...prev];
      while (nextParticipants.length < safe) {
        nextParticipants.push({
          displayName: '',
          age: '',
          participantType: 'unspecified',
          accessibilityNotes: '',
        });
      }
      return nextParticipants.slice(0, safe);
    });
  }

  function updateParticipant(
    index: number,
    field: keyof Participant,
    value: string
  ) {
    setParticipants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set('sessionId', sessionId);
    formData.set('quantity', String(quantity));
    formData.set('participants', JSON.stringify(participants));
    formData.set('marketingConsent', marketingConsent ? 'true' : 'false');
    formData.set('termsAccepted', termsAccepted ? 'true' : 'false');
    formData.set('privacyPolicyVersion', privacyPolicyVersion);

    startTransition(async () => {
      const result = await createBookingAndCheckout(formData);
      if (result.ok) {
        window.location.href = result.checkoutUrl;
      } else {
        setError(
          result.error ?? 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6" noValidate>
      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Nie wypełniaj tego pola</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <section>
        <label htmlFor="sessionId" className="block font-medium mb-2">
          Wybierz termin
        </label>
        <select
          id="sessionId"
          name="sessionId"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="w-full rounded border p-2"
          required
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {formatWarsawDateTime(s.starts_at)} –{' '}
              {s.location_name ?? 'Atelier'} ({formatPrice(s.price_gross_grosz)}
              , dostępnych {s.capacity - s.reserved_count})
            </option>
          ))}
        </select>
      </section>

      <section>
        <label htmlFor="quantity" className="block font-medium mb-2">
          Liczba miejsc
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          max={available}
          value={quantity}
          onChange={(e) => updateQuantity(parseInt(e.target.value, 10))}
          className="rounded border p-2 w-24"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Dostępnych {available} z {selectedSession.capacity}. Wybrane:{' '}
          {quantity}. Razem: {formatPrice(totalPrice)}.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Dane uczestników</h2>
        {participants.map((p, i) => (
          <div key={i} className="border rounded p-4 space-y-3">
            <p className="font-medium">Uczestnik {i + 1}</p>
            <input
              name={`participant-${i}-displayName`}
              type="text"
              placeholder="Imię / nazwisko uczestnika"
              value={p.displayName}
              onChange={(e) =>
                updateParticipant(i, 'displayName', e.target.value)
              }
              className="w-full rounded border p-2"
              required
              minLength={1}
              maxLength={200}
            />
            {(workshop.minimum_age !== null ||
              workshop.maximum_age !== null) && (
              <input
                name={`participant-${i}-age`}
                type="number"
                placeholder="Wiek"
                value={p.age}
                onChange={(e) => updateParticipant(i, 'age', e.target.value)}
                className="w-full rounded border p-2"
                required
                min={workshop.minimum_age ?? 0}
                max={workshop.maximum_age ?? 99}
              />
            )}
            <input
              name={`participant-${i}-accessibilityNotes`}
              type="text"
              placeholder="Uwagi dostępności (opcjonalnie)"
              value={p.accessibilityNotes}
              onChange={(e) =>
                updateParticipant(i, 'accessibilityNotes', e.target.value)
              }
              className="w-full rounded border p-2"
              maxLength={1000}
            />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Dane kupującego</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            name="purchaserFirstName"
            type="text"
            placeholder="Imię"
            className="rounded border p-2"
            required
            maxLength={200}
          />
          <input
            name="purchaserLastName"
            type="text"
            placeholder="Nazwisko"
            className="rounded border p-2"
            required
            maxLength={200}
          />
        </div>
        <input
          name="purchaserEmail"
          type="email"
          placeholder="Adres e-mail"
          className="w-full rounded border p-2"
          required
          maxLength={255}
        />
        <input
          name="purchaserPhone"
          type="tel"
          placeholder="Telefon"
          className="w-full rounded border p-2"
          required
          maxLength={50}
        />
        <textarea
          name="customerNotes"
          placeholder="Uwagi do rezerwacji (opcjonalnie)"
          className="w-full rounded border p-2"
          maxLength={2000}
          rows={3}
        />
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3">
          <input
            name="termsAccepted"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm">
            Akceptuję regulamin rezerwacji i politykę prywatności (wersja{' '}
            {privacyPolicyVersion}). Rezerwacja jest wymagana do uczestnictwa w
            warsztacie.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            name="marketingConsent"
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            Chcę otrzymywać informacje o przyszłych warsztatach (opcjonalne,
            wymagana zgoda może być wycofana w każdej chwili).
          </span>
        </label>
      </section>

      {error && (
        <div className="rounded bg-red-50 text-red-700 p-3" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded bg-primary px-6 py-3 text-primary-foreground font-medium disabled:opacity-50"
      >
        {isPending
          ? 'Przetwarzanie...'
          : `Rezerwuj i płać – ${formatPrice(totalPrice)}`}
      </button>
    </form>
  );
}
