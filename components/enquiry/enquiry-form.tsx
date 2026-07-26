'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { submitEnquiry } from '@/lib/enquiries/submit';

export function EnquiryForm({
  offerKey,
  offerTitle,
}: {
  offerKey?: string | null;
  offerTitle?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredContact, setPreferredContact] = useState<
    'email' | 'phone' | 'whatsapp'
  >('email');
  const [eventType, setEventType] = useState('');
  const [participantCount, setParticipantCount] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [message, setMessage] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!privacy) {
      setError('Zaakceptuj politykę prywatności, aby wysłać zapytanie.');
      return;
    }
    startTransition(async () => {
      const result = await submitEnquiry({
        offerKey: offerKey || null,
        offerTitle: offerTitle || null,
        customerName: name,
        customerEmail: email,
        customerPhone: phone || null,
        preferredContact,
        eventType: eventType || null,
        participantCount: participantCount ? Number(participantCount) : null,
        preferredDateText: preferredDate || null,
        message,
        privacyAccepted: true as const,
        marketingConsent: marketing,
        companyWebsite: honeypot || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReference(result.reference);
    });
  }

  if (reference) {
    return (
      <div className="rounded border border-surface-subtle bg-surface-raised p-6">
        <h2 className="font-heading text-2xl font-semibold">
          Dziękujemy za zapytanie
        </h2>
        <p className="mt-3 text-sm text-text-muted">
          Numer sprawy:{' '}
          <strong className="text-text-primary">{reference}</strong>
        </p>
        <p className="mt-2 text-sm text-text-muted">
          Odpowiemy tak szybko, jak to możliwe — zwykle w ciągu 1–2 dni
          roboczych.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {offerTitle || offerKey ? (
        <p className="text-sm text-text-muted">
          Oferta:{' '}
          <strong className="text-text-primary">
            {offerTitle || offerKey}
          </strong>
        </p>
      ) : null}

      <label className="block text-sm">
        Imię i nazwisko *
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
          autoComplete="name"
        />
      </label>
      <label className="block text-sm">
        E-mail *
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
          autoComplete="email"
        />
      </label>
      <label className="block text-sm">
        Telefon
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
          autoComplete="tel"
        />
      </label>
      <label className="block text-sm">
        Preferowany kontakt
        <select
          value={preferredContact}
          onChange={(e) =>
            setPreferredContact(e.target.value as typeof preferredContact)
          }
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
        >
          <option value="email">E-mail</option>
          <option value="phone">Telefon</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      </label>
      <label className="block text-sm">
        Rodzaj wydarzenia / warsztatu
        <input
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Orientacyjna liczba osób
        <input
          type="number"
          min={1}
          max={500}
          value={participantCount}
          onChange={(e) => setParticipantCount(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Preferowany termin lub zakres dat
        <input
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          className="mt-1 min-h-11 w-full border border-surface-subtle px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        Wiadomość *
        <textarea
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full border border-surface-subtle px-3 py-2"
        />
      </label>

      {/* Honeypot */}
      <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        Strona firmowa
        <input
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={privacy}
          onChange={(e) => setPrivacy(e.target.checked)}
          required
          className="mt-1"
        />
        <span>
          Akceptuję{' '}
          <Link href="/polityka-prywatnosci" className="underline">
            politykę prywatności
          </Link>
          . *
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          className="mt-1"
        />
        <span>Chcę otrzymywać informacje o warsztatach (opcjonalnie).</span>
      </label>

      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !privacy}
        className="min-h-11 w-full bg-accent-primary px-4 py-3 text-sm font-semibold text-white disabled:bg-gray-400"
      >
        {isPending ? 'Wysyłanie…' : 'Wyślij zapytanie'}
      </button>
    </form>
  );
}
