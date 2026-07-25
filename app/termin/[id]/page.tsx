import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/utils/price';
import {
  isBookingLocalMode,
  LOCAL_BOOKING_BANNER,
} from '@/lib/booking/local-mode';
import { createClient } from '@/lib/supabase/server';

function formatWarsaw(iso: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (isBookingLocalMode()) {
    const [{ ensureLocalBookingSeed }, { getLocalSession }] = await Promise.all([
      import('@/lib/booking/local-seed'),
      import('@/lib/booking/local-store'),
    ]);
    await ensureLocalBookingSeed();
    const session = await getLocalSession(id);
    if (!session || !session.published || session.status === 'cancelled') {
      notFound();
    }
    const free = session.capacity - session.reservedCount;
    const soldOut = free <= 0 || session.status === 'sold_out';

    return (
      <main className="container mx-auto max-w-3xl px-4 py-16">
        <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {LOCAL_BOOKING_BANNER}
        </p>
        <p className="text-sm font-semibold tracking-wide text-accent-primary uppercase">
          Szczegóły terminu
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-text-primary">
          {session.workshopTitle}
        </h1>
        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-text-muted">Data i godzina</dt>
            <dd className="mt-1 text-lg">{formatWarsaw(session.startsAt)}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Czas trwania</dt>
            <dd className="mt-1">
              do {formatWarsaw(session.endsAt)} ({session.timezone})
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Miejsce</dt>
            <dd className="mt-1">
              {[session.locationName, session.locationAddress]
                .filter(Boolean)
                .join(', ') || 'Pracownia Ceramika Nero'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Cena</dt>
            <dd className="mt-1 text-lg font-semibold">
              {formatPrice(session.priceGrossGrosz)} / osoba
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-muted">Dostępność</dt>
            <dd className="mt-1">
              {soldOut
                ? 'Brak wolnych miejsc'
                : `${free} z ${session.capacity} wolnych miejsc`}
            </dd>
          </div>
        </dl>
        <div className="mt-10 flex flex-wrap gap-3">
          {soldOut ? (
            <Link
              href="/kontakt"
              className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase"
            >
              Zapytaj o listę rezerwową
            </Link>
          ) : (
            <Link
              href={`/warsztaty/${session.workshopSlug}/rezerwacja?session=${session.id}`}
              className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase"
            >
              Zarezerwuj
            </Link>
          )}
          <Link
            href="/kalendarz"
            className="inline-flex border border-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-accent-primary uppercase"
          >
            Wróć do kalendarza
          </Link>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('workshop_sessions')
    .select(
      `
      id, starts_at, ends_at, timezone, capacity, reserved_count,
      price_gross_grosz, status, location_name, location_address,
      workshops!inner (title, slug, status, archived_at)
    `
    )
    .eq('id', id)
    .single();

  if (!data) notFound();
  const workshop = data.workshops as {
    title: string;
    slug: string;
    status: string;
    archived_at: string | null;
  };
  if (workshop.status !== 'published' || workshop.archived_at) notFound();
  if (!['scheduled', 'sold_out'].includes(data.status)) notFound();

  const free = data.capacity - data.reserved_count;
  const soldOut = free <= 0 || data.status === 'sold_out';

  return (
    <main className="container mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-semibold tracking-wide text-accent-primary uppercase">
        Szczegóły terminu
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold text-text-primary">
        {workshop.title}
      </h1>
      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="font-medium text-text-muted">Data i godzina</dt>
          <dd className="mt-1 text-lg">{formatWarsaw(data.starts_at)}</dd>
        </div>
        <div>
          <dt className="font-medium text-text-muted">Miejsce</dt>
          <dd className="mt-1">
            {[data.location_name, data.location_address]
              .filter(Boolean)
              .join(', ') || 'Pracownia Ceramika Nero'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-text-muted">Cena</dt>
          <dd className="mt-1 text-lg font-semibold">
            {formatPrice(data.price_gross_grosz)} / osoba
          </dd>
        </div>
        <div>
          <dt className="font-medium text-text-muted">Dostępność</dt>
          <dd className="mt-1">
            {soldOut
              ? 'Brak wolnych miejsc'
              : `${free} z ${data.capacity} wolnych miejsc`}
          </dd>
        </div>
      </dl>
      <div className="mt-10 flex flex-wrap gap-3">
        {soldOut ? (
          <Link
            href="/kontakt"
            className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase"
          >
            Zapytaj o listę rezerwową
          </Link>
        ) : (
          <Link
            href={`/warsztaty/${workshop.slug}/rezerwacja?session=${data.id}`}
            className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-white uppercase"
          >
            Zarezerwuj
          </Link>
        )}
        <Link
          href="/kalendarz"
          className="inline-flex border border-accent-primary px-5 py-3 text-sm font-semibold tracking-wide text-accent-primary uppercase"
        >
          Wróć do kalendarza
        </Link>
      </div>
    </main>
  );
}
