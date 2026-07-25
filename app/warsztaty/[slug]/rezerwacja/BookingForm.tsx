'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
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

type Step = 'details' | 'review';

type Props = {
  workshop: Workshop;
  sessions: Session[];
  privacyPolicyVersion: string;
  localMode?: boolean;
};

export function BookingForm({
  workshop,
  sessions,
  privacyPolicyVersion,
  localMode = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState<Step>('details');
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
  const [purchaserFirstName, setPurchaserFirstName] = useState('');
  const [purchaserLastName, setPurchaserLastName] = useState('');
  const [purchaserEmail, setPurchaserEmail] = useState('');
  const [purchaserPhone, setPurchaserPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
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

  function validateDetails(): string | null {
    if (!termsAccepted) {
      return 'Akceptacja regulaminu i polityki prywatności jest wymagana.';
    }
    if (!purchaserFirstName.trim() || !purchaserLastName.trim()) {
      return 'Podaj imię i nazwisko kupującego.';
    }
    if (!purchaserEmail.trim() || !purchaserEmail.includes('@')) {
      return 'Podaj prawidłowy adres e-mail.';
    }
    if (!purchaserPhone.trim()) {
      return 'Podaj numer telefonu.';
    }
    for (let i = 0; i < participants.length; i++) {
      if (!participants[i]?.displayName.trim()) {
        return `Podaj imię uczestnika ${i + 1}.`;
      }
    }
    return null;
  }

  function goToReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const validationError = validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep('review');
  }

  function handleSubmit() {
    setError(null);
    setFieldErrors({});
    const formData = new FormData();
    formData.set('website', '');
    formData.set('sessionId', sessionId);
    formData.set('quantity', String(quantity));
    formData.set(
      'participants',
      JSON.stringify(
        participants.map((p) => ({
          displayName: p.displayName,
          age: p.age ? Number(p.age) : undefined,
          participantType: p.participantType,
          accessibilityNotes: p.accessibilityNotes || undefined,
        }))
      )
    );
    formData.set('purchaserFirstName', purchaserFirstName);
    formData.set('purchaserLastName', purchaserLastName);
    formData.set('purchaserEmail', purchaserEmail);
    formData.set('purchaserPhone', purchaserPhone);
    formData.set('customerNotes', customerNotes);
    formData.set('marketingConsent', marketingConsent ? 'true' : 'false');
    formData.set('termsAccepted', termsAccepted ? 'true' : 'false');
    formData.set('privacyPolicyVersion', privacyPolicyVersion);

    startTransition(async () => {
      const result = await createBookingAndCheckout(formData);
      if (result.ok) {
        window.location.href = result.checkoutUrl;
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setError(
          result.error ?? 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
        );
        setStep('details');
      }
    });
  }

  if (step === 'review') {
    return (
      <div className="max-w-2xl space-y-6">
        <h2 className="text-xl font-semibold">Podsumowanie rezerwacji</h2>
        <dl className="space-y-3 rounded border p-4 text-sm">
          <div>
            <dt className="font-medium text-text-muted">Warsztat</dt>
            <dd>{workshop.title}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Termin</dt>
            <dd>{formatWarsawDateTime(selectedSession.starts_at)}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Miejsce</dt>
            <dd>
              {[selectedSession.location_name, selectedSession.location_address]
                .filter(Boolean)
                .join(', ') || 'Pracownia'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Uczestnicy</dt>
            <dd>
              <ul className="list-disc pl-5">
                {participants.map((p, i) => (
                  <li key={i}>
                    {p.displayName}
                    {p.age ? ` (${p.age} l.)` : ''}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Kupujący</dt>
            <dd>
              {purchaserFirstName} {purchaserLastName}
              <br />
              {purchaserEmail}
              <br />
              {purchaserPhone}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Do zapłaty</dt>
            <dd className="text-lg font-semibold">
              {formatPrice(totalPrice)}
              {localMode ? ' (tryb lokalny — bez Stripe)' : ''}
            </dd>
          </div>
        </dl>

        {error && (
          <div className="rounded bg-red-50 p-3 text-red-700" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setStep('details')}
            className="rounded border px-5 py-3 text-sm font-medium"
            disabled={isPending}
          >
            Wróć do edycji
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded bg-primary px-6 py-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending
              ? 'Przetwarzanie...'
              : localMode
                ? `Potwierdź rezerwację – ${formatPrice(totalPrice)}`
                : `Potwierdź rezerwację – ${formatPrice(totalPrice)}`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={goToReview} className="max-w-2xl space-y-6" noValidate>
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
        <label htmlFor="sessionId" className="mb-2 block font-medium">
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
        <label htmlFor="quantity" className="mb-2 block font-medium">
          Liczba miejsc
        </label>
        <input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          max={available}
          value={quantity}
          onChange={(e) => updateQuantity(parseInt(e.target.value, 10) || 1)}
          className="w-24 rounded border p-2"
          required
        />
        <p className="text-muted-foreground mt-1 text-sm">
          Dostępnych {available} z {selectedSession.capacity}. Wybrane:{' '}
          {quantity}. Razem: {formatPrice(totalPrice)}.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Dane uczestników</h2>
        {participants.map((p, i) => (
          <div key={i} className="space-y-3 rounded border p-4">
            <p className="font-medium">Uczestnik {i + 1}</p>
            <input
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            type="text"
            placeholder="Imię"
            value={purchaserFirstName}
            onChange={(e) => setPurchaserFirstName(e.target.value)}
            className="rounded border p-2"
            required
            maxLength={200}
            autoComplete="given-name"
          />
          <input
            type="text"
            placeholder="Nazwisko"
            value={purchaserLastName}
            onChange={(e) => setPurchaserLastName(e.target.value)}
            className="rounded border p-2"
            required
            maxLength={200}
            autoComplete="family-name"
          />
        </div>
        <input
          type="email"
          placeholder="Adres e-mail"
          value={purchaserEmail}
          onChange={(e) => setPurchaserEmail(e.target.value)}
          className="w-full rounded border p-2"
          required
          maxLength={255}
          autoComplete="email"
        />
        <input
          type="tel"
          placeholder="Telefon"
          value={purchaserPhone}
          onChange={(e) => setPurchaserPhone(e.target.value)}
          className="w-full rounded border p-2"
          required
          maxLength={50}
          autoComplete="tel"
        />
        <textarea
          placeholder="Uwagi do rezerwacji (opcjonalnie)"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          className="w-full rounded border p-2"
          maxLength={2000}
          rows={3}
        />
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1"
            required
          />
          <span className="text-sm">
            Akceptuję{' '}
            <Link href="/regulamin" className="underline" target="_blank">
              regulamin
            </Link>{' '}
            oraz{' '}
            <Link
              href="/polityka-prywatnosci"
              className="underline"
              target="_blank"
            >
              politykę prywatności
            </Link>{' '}
            (wersja {privacyPolicyVersion}). Rezerwacja jest wymagana do
            uczestnictwa w warsztacie.
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            Chcę otrzymywać informacje o przyszłych warsztatach (opcjonalne,
            zgodę można wycofać w każdej chwili).
          </span>
        </label>
      </section>

      {error && (
        <div className="rounded bg-red-50 p-3 text-red-700" role="alert">
          {error}
        </div>
      )}
      {Object.keys(fieldErrors).length > 0 && (
        <div
          className="rounded bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <ul className="list-disc pl-5">
            {Object.entries(fieldErrors).map(([field, errors]) =>
              errors.map((msg) => (
                <li key={`${field}-${msg}`}>
                  {field}: {msg}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded bg-primary px-6 py-3 font-medium text-primary-foreground"
      >
        Przejdź do podsumowania
      </button>
    </form>
  );
}
