import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BookingForm } from './BookingForm';

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
        <h1 className="text-3xl font-bold mb-4">Rezerwacja</h1>
        <p className="text-lg">
          Brak dostępnych terminów dla warsztatu{' '}
          <strong>{workshop.title}</strong>.
        </p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">Rezerwacja: {workshop.title}</h1>
      <p className="text-muted-foreground mb-8">
        Wybierz termin i podaj dane uczestników. Rezerwacja nie jest płatna – po
        kliknięciu „Rezerwuj i płać” przekierujemy Cię do bezpiecznej płatności
        Stripe.
      </p>
      <BookingForm
        workshop={workshop}
        sessions={availableSessions}
        privacyPolicyVersion="1.0"
      />
    </main>
  );
}
