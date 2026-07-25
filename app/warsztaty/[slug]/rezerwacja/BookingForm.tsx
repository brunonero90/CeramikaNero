'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalCart } from '@/components/clone/local-cart';
import { workshopLineKey } from '@/lib/cart/types';
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
  venue_key?: string | null;
};

type Workshop = {
  id: string;
  title: string;
  slug?: string;
  minimum_age: number | null;
  maximum_age: number | null;
  default_price_gross_grosz: number;
};

type Props = {
  workshop: Workshop;
  workshopSlug: string;
  sessions: Session[];
  privacyPolicyVersion: string;
  localMode?: boolean;
};

export function BookingForm({ workshop, workshopSlug, sessions }: Props) {
  const router = useRouter();
  const { addLine } = useLocalCart();
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? sessions[0],
    [sessions, sessionId]
  );

  if (!selectedSession) {
    return <p>Brak dostępnych terminów.</p>;
  }

  const available = Math.min(
    selectedSession.capacity - selectedSession.reserved_count,
    MAX_PARTICIPANTS_PER_BOOKING
  );
  const totalPrice = selectedSession.price_gross_grosz * quantity;

  function onAdd() {
    addLine({
      type: 'workshop_session',
      key: workshopLineKey(selectedSession.id),
      sessionId: selectedSession.id,
      workshopId: workshop.id,
      workshopSlug,
      workshopTitle: workshop.title,
      startsAt: selectedSession.starts_at,
      timezone: selectedSession.timezone,
      venueKey: selectedSession.venue_key ?? null,
      locationName: selectedSession.location_name,
      locationAddress: selectedSession.location_address,
      quantity,
      unitPriceHintGrosz: selectedSession.price_gross_grosz,
    });
    setAdded(true);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Dodanie do koszyka nie rezerwuje jeszcze miejsca. Dostępność sprawdzimy
        ponownie przy składaniu zamówienia.
      </p>

      <label className="block text-sm font-medium">
        Termin
        <select
          className="mt-1 w-full border px-3 py-2"
          value={selectedSession.id}
          onChange={(e) => {
            setSessionId(e.target.value);
            setAdded(false);
          }}
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {formatWarsawDateTime(s.starts_at)}
              {s.location_name ? ` — ${s.location_name}` : ''} · wolne:{' '}
              {s.capacity - s.reserved_count}
            </option>
          ))}
        </select>
      </label>

      <p className="text-sm text-text-muted">
        {[selectedSession.location_name, selectedSession.location_address]
          .filter(Boolean)
          .join(', ')}
      </p>

      <label className="block text-sm font-medium">
        Liczba uczestników
        <input
          type="number"
          min={1}
          max={available}
          className="mt-1 w-32 border px-3 py-2"
          value={quantity}
          onChange={(e) => {
            const next = Math.max(
              1,
              Math.min(available, Number(e.target.value) || 1)
            );
            setQuantity(next);
            setAdded(false);
          }}
        />
      </label>

      <p className="text-lg font-semibold">
        Cena orientacyjna: {formatPrice(totalPrice)}
      </p>

      {!added ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full bg-accent-primary px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase"
        >
          Dodaj do koszyka
        </button>
      ) : (
        <div className="space-y-3 rounded border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            Dodano do koszyka.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push('/cart')}
              className="bg-accent-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Przejdź do koszyka
            </button>
            <Link
              href="/warsztaty"
              className="border px-4 py-2 text-sm font-semibold"
            >
              Kontynuuj zakupy
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
