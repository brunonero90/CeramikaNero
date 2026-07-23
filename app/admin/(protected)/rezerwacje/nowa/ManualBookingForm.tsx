'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createManualBookingAction } from '../actions';
import { formatPrice } from '@/lib/utils/price';
import { formatWarsawDateTime } from '@/lib/utils/datetime';

type Participant = {
  displayName: string;
  age: string;
  participantType: 'adult' | 'child' | 'unspecified';
  accessibilityNotes: string;
};

type Workshop = {
  id: string;
  title: string;
  minimum_age: number | null;
  maximum_age: number | null;
  default_price_gross_grosz: number;
};

type Session = {
  id: string;
  workshop_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  reserved_count: number;
  price_gross_grosz: number;
  location_name: string | null;
  location_address: string | null;
};

export function ManualBookingForm({
  workshops,
  sessions,
}: {
  workshops: Workshop[];
  sessions: Session[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [workshopId, setWorkshopId] = useState<string>(workshops[0]?.id ?? '');
  const workshop = workshops.find((w) => w.id === workshopId);
  const availableSessions = sessions.filter(
    (s) => s.workshop_id === workshopId
  );
  const [sessionId, setSessionId] = useState<string>(
    availableSessions[0]?.id ?? ''
  );
  const selectedSession = availableSessions.find((s) => s.id === sessionId);
  const [quantity, setQuantity] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      displayName: '',
      age: '',
      participantType: 'unspecified',
      accessibilityNotes: '',
    },
  ]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'confirmed'>(
    'confirmed'
  );
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');

  const maxQuantity = Math.min(
    selectedSession
      ? selectedSession.capacity - selectedSession.reserved_count
      : 0,
    10
  );
  const totalPrice =
    (selectedSession?.price_gross_grosz ??
      workshop?.default_price_gross_grosz ??
      0) * quantity;

  function updateQuantity(next: number) {
    const safe = Math.max(1, Math.min(next, maxQuantity));
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

  function handleWorkshopChange(id: string) {
    setWorkshopId(id);
    const first = sessions.find((s) => s.workshop_id === id);
    setSessionId(first?.id ?? '');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const input = {
      sessionId,
      quantity,
      purchaserEmail: String(formData.get('purchaserEmail')),
      purchaserFirstName: String(formData.get('purchaserFirstName')),
      purchaserLastName: String(formData.get('purchaserLastName')),
      purchaserPhone: String(formData.get('purchaserPhone')),
      customerNotes: String(formData.get('customerNotes') || ''),
      marketingConsent,
      privacyPolicyVersion: 'admin',
      participants: participants.map((p) => ({
        displayName: p.displayName,
        age: p.age ? Number(p.age) : undefined,
        participantType: p.participantType,
        accessibilityNotes: p.accessibilityNotes,
      })),
      paymentMethod: paymentMethod as
        'cash' | 'bank_transfer' | 'card_terminal' | 'complimentary' | 'other',
      paymentStatus,
      internalNotes,
    };

    startTransition(async () => {
      const result = await createManualBookingAction(input);
      if (result.ok) {
        router.push('/admin/rezerwacje/' + result.bookingId);
      } else {
        setError(result.error ?? 'Nie udało się utworzyć rezerwacji.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <section>
        <label className="block font-medium mb-2">Warsztat</label>
        <select
          value={workshopId}
          onChange={(e) => handleWorkshopChange(e.target.value)}
          className="w-full rounded border p-2"
          required
        >
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </section>

      <section>
        <label className="block font-medium mb-2">Termin</label>
        <select
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="w-full rounded border p-2"
          required
        >
          {availableSessions.map((s) => (
            <option key={s.id} value={s.id}>
              {formatWarsawDateTime(s.starts_at)} – dostępnych{' '}
              {s.capacity - s.reserved_count} z {s.capacity}
            </option>
          ))}
        </select>
      </section>

      <section>
        <label className="block font-medium mb-2">Liczba miejsc</label>
        <input
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(e) => updateQuantity(Number(e.target.value))}
          className="rounded border p-2 w-24"
          required
        />
        <p className="text-sm text-muted-foreground mt-1">
          Razem: {formatPrice(totalPrice)}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Uczestnicy</h2>
        {participants.map((p, i) => (
          <div key={i} className="border rounded p-4 space-y-3">
            <p className="font-medium">Uczestnik {i + 1}</p>
            <input
              type="text"
              placeholder="Imię / nazwisko"
              value={p.displayName}
              onChange={(e) =>
                updateParticipant(i, 'displayName', e.target.value)
              }
              className="w-full rounded border p-2"
              required
              maxLength={200}
            />
            {(workshop?.minimum_age !== null ||
              workshop?.maximum_age !== null) && (
              <input
                type="number"
                placeholder="Wiek"
                value={p.age}
                onChange={(e) => updateParticipant(i, 'age', e.target.value)}
                className="w-full rounded border p-2"
                required
                min={workshop?.minimum_age ?? 0}
                max={workshop?.maximum_age ?? 99}
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
        <h2 className="text-xl font-semibold">Kupujący</h2>
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
          placeholder="E-mail"
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
          placeholder="Uwagi (opcjonalnie)"
          className="w-full rounded border p-2"
          maxLength={2000}
          rows={3}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Płatność</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Metoda</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded border p-2"
            >
              <option value="cash">Gotówka</option>
              <option value="bank_transfer">Przelew</option>
              <option value="card_terminal">Terminal</option>
              <option value="complimentary">Gratis</option>
              <option value="other">Inna</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value as 'pending' | 'confirmed')
              }
              className="w-full rounded border p-2"
            >
              <option value="confirmed">Potwierdzona</option>
              <option value="pending">Oczekuje płatności</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">Zgoda marketingowa</span>
        </label>
      </section>

      <section>
        <label className="block text-sm font-medium mb-1">
          Notatka wewnętrzna
        </label>
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          className="w-full rounded border p-2"
          maxLength={2000}
          rows={3}
        />
      </section>

      {error && (
        <div className="rounded bg-red-50 text-red-700 p-3" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded bg-gray-900 px-6 py-3 text-white font-medium disabled:opacity-50"
      >
        {isPending ? 'Tworzenie...' : 'Utwórz rezerwację'}
      </button>
    </form>
  );
}
