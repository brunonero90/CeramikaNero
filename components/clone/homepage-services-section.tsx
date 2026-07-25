'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CloneCta } from '@/components/clone/marketing';
import type { HomepageVenueKey } from '@/lib/clone/content/landings';

export type HomepageServiceView = {
  id: string;
  title: string;
  day: string;
  price: string;
  image: string;
  imageAlt: string;
  moreHref: string;
  href: string;
  cta: string;
  venueKey: HomepageVenueKey;
  soldOut?: boolean;
};

type FilterId = 'all' | 'suchy-las' | 'other';

const FILTERS: { id: FilterId; label: string; ariaLabel: string }[] = [
  {
    id: 'all',
    label: 'Wszystkie usługi',
    ariaLabel: 'Pokaż wszystkie usługi',
  },
  {
    id: 'suchy-las',
    label: 'CERAMIKA NERO PODGÓRNA 3 SUCHY LAS',
    ariaLabel: 'Filtruj: Ceramika Nero, Podgórna 3, Suchy Las',
  },
  {
    id: 'other',
    label: 'Inne lokalizacje',
    ariaLabel: 'Filtruj: inne lokalizacje',
  },
];

function parseFilter(raw: string | null): FilterId {
  if (raw === 'suchy-las' || raw === 'other') return raw;
  return 'all';
}

function matchesFilter(venueKey: HomepageVenueKey, filter: FilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'suchy-las') return venueKey === 'suchy-las';
  // "Inne lokalizacje" — currently only Ptasie Radio (exclude enquiry-only cards).
  return venueKey === 'ptasie-radio';
}

export function HomepageServicesSection({
  chips,
  services,
}: {
  chips: string[];
  services: HomepageServiceView[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseFilter(searchParams.get('lokalizacja'));

  const setFilter = useCallback(
    (next: FilterId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === 'all') params.delete('lokalizacja');
      else params.set('lokalizacja', next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const filtered = useMemo(
    () => services.filter((s) => matchesFilter(s.venueKey, active)),
    [services, active]
  );

  const chipLabels = chips.length >= 3 ? chips : FILTERS.map((f) => f.label);

  return (
    <>
      <div
        className="mt-8 flex flex-wrap items-center justify-center gap-3"
        role="group"
        aria-label="Filtr lokalizacji warsztatów"
      >
        {FILTERS.map((filter, index) => {
          const pressed = active === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={pressed}
              aria-label={filter.ariaLabel}
              onClick={() => setFilter(filter.id)}
              className={
                pressed
                  ? 'bg-text-primary px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'
                  : 'border border-surface-subtle px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary'
              }
            >
              {chipLabels[index] ?? filter.label}
            </button>
          );
        })}
      </div>

      <section
        aria-label="Lista warsztatów"
        className="mx-auto mt-8 grid max-w-5xl gap-6 px-4 pb-10 sm:grid-cols-2 md:px-6 lg:grid-cols-3"
      >
        {filtered.length === 0 ? (
          <p className="col-span-full text-center text-sm text-text-muted">
            Brak warsztatów w wybranej lokalizacji. Wybierz „Wszystkie usługi”
            albo inną lokalizację.
          </p>
        ) : (
          filtered.map((service) => (
            <article
              key={service.id}
              className="flex flex-col border border-surface-subtle/50 bg-surface-raised"
            >
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 303px"
                />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-heading text-base font-semibold tracking-wide text-text-primary uppercase">
                  {service.title}
                </h2>
                <p className="mt-2">
                  <Link
                    href={service.moreHref}
                    className="text-sm text-accent-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    Więcej
                  </Link>
                </p>
                <div className="mt-4 flex items-end justify-between gap-3 text-sm text-text-muted">
                  <span>{service.day}</span>
                  <span className="font-semibold text-text-primary">
                    {service.price}
                  </span>
                </div>
                <div className="mt-5">
                  {service.soldOut ? (
                    <p className="text-sm font-semibold text-text-muted">
                      Brak wolnych miejsc
                    </p>
                  ) : null}
                  <CloneCta href={service.href} className="mt-2 w-full">
                    {service.cta}
                  </CloneCta>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
