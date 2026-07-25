import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingForm } from './BookingForm';
import {
  isBookingLocalMode,
  LOCAL_BOOKING_BANNER,
} from '@/lib/booking/local-mode';

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { slug } = await params;
  const { session: preferredSessionId } = await searchParams;

  if (isBookingLocalMode()) {
    const [
      { ensureLocalBookingSeed },
      { listLocalSessions },
      { getBySlug: getFixtureWorkshop },
    ] = await Promise.all([
      import('@/lib/booking/local-seed'),
      import('@/lib/booking/local-store'),
      import('@/lib/database/fixtures/workshops'),
    ]);
    await ensureLocalBookingSeed();
    const workshop = await getFixtureWorkshop(slug);
    if (!workshop || workshop.bookingMode !== 'scheduled') {
      notFound();
    }

    const sessions = (await listLocalSessions({ workshopSlug: slug })).filter(
      (s) => s.capacity - s.reservedCount > 0 && s.status !== 'sold_out'
    );

    if (sessions.length === 0) {
      return (
        <main className="container mx-auto px-4 py-16">
          <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {LOCAL_BOOKING_BANNER}
          </p>
          <h1 className="mb-4 text-3xl font-bold">Rezerwacja</h1>
          <p className="text-lg">
            Brak dostępnych terminów dla warsztatu{' '}
            <strong>{workshop.title}</strong>.
          </p>
        </main>
      );
    }

    const ordered = preferredSessionId
      ? [
          ...sessions.filter((s) => s.id === preferredSessionId),
          ...sessions.filter((s) => s.id !== preferredSessionId),
        ]
      : sessions;

    return (
      <main className="container mx-auto px-4 py-16">
        <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {LOCAL_BOOKING_BANNER}
        </p>
        <h1 className="mb-2 text-3xl font-bold">
          Rezerwacja: {workshop.title}
        </h1>
        <p className="text-muted-foreground mb-8">
          Wybierz termin i liczbę osób, a następnie dodaj pozycję do koszyka.
        </p>
        <BookingForm
          workshop={{
            id: workshop.id,
            title: workshop.title,
            minimum_age: workshop.minimumAge,
            maximum_age: workshop.maximumAge,
            default_price_gross_grosz: workshop.defaultPriceGrossGrosz,
          }}
          workshopSlug={slug}
          sessions={ordered.map((s) => ({
            id: s.id,
            starts_at: s.startsAt,
            ends_at: s.endsAt,
            timezone: s.timezone,
            capacity: s.capacity,
            reserved_count: s.reservedCount,
            price_gross_grosz: s.priceGrossGrosz,
            location_name: s.locationName,
            location_address: s.locationAddress,
          }))}
          privacyPolicyVersion="1.0"
          localMode
        />
      </main>
    );
  }

  const supabase = await createClient();

  const { data: workshop } = await supabase
    .from('workshops')
    .select(
      'id, title, slug, description, minimum_age, maximum_age, default_price_gross_grosz, status, booking_mode, archived_at, suggested_theme'
    )
    .eq('slug', slug)
    .single();

  if (
    !workshop ||
    workshop.status !== 'published' ||
    workshop.archived_at ||
    workshop.booking_mode !== 'scheduled'
  ) {
    notFound();
  }

  const now = new Date().toISOString();
  const { data: sessions } = await supabase
    .from('workshop_sessions')
    .select(
      'id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz, location_name, location_address'
    )
    .eq('workshop_id', workshop.id)
    .in('status', ['scheduled', 'sold_out'])
    .gte('starts_at', now)
    .order('starts_at', { ascending: true });

  const availableSessions = (sessions ?? []).filter(
    (s) => s.capacity - s.reserved_count > 0
  );

  if (availableSessions.length === 0) {
    return (
      <main className="container mx-auto px-4 py-16">
        <h1 className="mb-4 text-3xl font-bold">Rezerwacja</h1>
        <p className="text-lg">
          Brak dostępnych terminów dla warsztatu{' '}
          <strong>{workshop.title}</strong>.
        </p>
      </main>
    );
  }

  const ordered = preferredSessionId
    ? [
        ...availableSessions.filter((s) => s.id === preferredSessionId),
        ...availableSessions.filter((s) => s.id !== preferredSessionId),
      ]
    : availableSessions;

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold">Rezerwacja: {workshop.title}</h1>
      <p className="text-muted-foreground mb-8">
        Wybierz termin i liczbę uczestników, dodaj do koszyka, a dane kupującego
        uzupełnisz przy składaniu zamówienia.
      </p>
      <BookingForm
        workshop={workshop}
        workshopSlug={slug}
        sessions={ordered}
        privacyPolicyVersion="1.0"
      />
    </main>
  );
}
