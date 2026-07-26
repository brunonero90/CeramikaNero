'use client';

import { useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WorkshopCard } from '@/components/workshop/workshop-card';
import { EmptyState, PrimaryButton } from '@/components/public/ui';
import type { WorkshopWithCategory } from '@/lib/database/types';
import { cn } from '@/lib/utils/cn';

type FilterId =
  | 'all'
  | 'dzieci'
  | 'dorosli'
  | 'rodzina'
  | 'suchy-las'
  | 'other'
  | 'bookable'
  | 'enquiry';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'dzieci', label: 'Dla dzieci' },
  { id: 'dorosli', label: 'Dla dorosłych' },
  { id: 'rodzina', label: 'Rodzinne' },
  { id: 'suchy-las', label: 'Suchy Las' },
  { id: 'other', label: 'Inne lokalizacje' },
  { id: 'bookable', label: 'Do rezerwacji' },
  { id: 'enquiry', label: 'Zapytanie' },
];

function parseFilter(raw: string | null): FilterId {
  const ids = FILTERS.map((f) => f.id);
  if (raw && ids.includes(raw as FilterId)) return raw as FilterId;
  return 'all';
}

function matches(
  workshop: WorkshopWithCategory & { venueKeys?: string[] },
  filter: FilterId
): boolean {
  const cat = workshop.category?.slug ?? '';
  if (filter === 'all') return true;
  if (filter === 'dzieci') return cat === 'dla-dzieci';
  if (filter === 'dorosli')
    return cat === 'dla-doroslych' || cat === 'glina-do-wina';
  if (filter === 'rodzina') return cat === 'rodzinne';
  if (filter === 'bookable') return workshop.bookingMode === 'scheduled';
  if (filter === 'enquiry') return workshop.bookingMode === 'enquiry';
  if (filter === 'suchy-las') {
    // Structured: workshops default to Suchy Las unless they only have other venues.
    const keys = workshop.venueKeys ?? [];
    if (keys.length === 0) return workshop.slug !== 'glina-do-wina-w-poznaniu-w-ptasim-radiu';
    return keys.includes('suchy-las');
  }
  if (filter === 'other') {
    const keys = workshop.venueKeys ?? [];
    if (keys.length === 0)
      return workshop.slug === 'glina-do-wina-w-poznaniu-w-ptasim-radiu';
    return keys.includes('ptasie-radio') || keys.includes('other');
  }
  return true;
}

export function WorkshopCatalog({
  workshops,
}: {
  workshops: Array<WorkshopWithCategory & { venueKeys?: string[] }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseFilter(searchParams.get('filtr'));

  const setFilter = useCallback(
    (next: FilterId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('filtr');
      else params.set('filtr', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(
    () => workshops.filter((w) => matches(w, active)),
    [workshops, active]
  );

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtry katalogu warsztatów"
      >
        {FILTERS.map((f) => {
          const pressed = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-10 px-3 py-2 text-xs font-semibold tracking-wide uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                pressed
                  ? 'bg-text-primary text-white'
                  : 'border border-surface-subtle text-text-muted'
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        {filtered.length === 0 ? (
          <EmptyState
            title="Brak warsztatów w tym filtrze"
            description="Zmień filtr albo przejrzyj cały katalog."
            action={
              <PrimaryButton href="/warsztaty">Wyczyść filtry</PrimaryButton>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((workshop) => (
              <WorkshopCard key={workshop.id} workshop={workshop} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
