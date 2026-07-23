import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils/price';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; reference?: string }>;
}) {
  const { session_id, reference } = await searchParams;

  if (!session_id && !reference) {
    notFound();
  }

  const supabase = createAdminClient();
  let bookingReference = reference ?? null;

  if (session_id && !bookingReference) {
    const { data: payment } = await supabase
      .from('payments')
      .select('booking_id')
      .eq('provider_checkout_id', session_id)
      .single();
    if (!payment) {
      notFound();
    }
    const { data: bookingByPayment } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('id', payment.booking_id)
      .single();
    bookingReference = bookingByPayment?.booking_reference ?? null;
  }

  if (!bookingReference) {
    notFound();
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'booking_reference, status, quantity, total_price_gross_grosz, customer_profiles(email), workshop_sessions(starts_at, workshops(title))'
    )
    .eq('booking_reference', bookingReference)
    .single();

  if (!booking) {
    notFound();
  }

  const profile = booking.customer_profiles as { email: string };
  const session = booking.workshop_sessions as {
    starts_at: string;
    workshops: { title: string };
  };
  const date = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(session.starts_at));

  const confirmed = booking.status === 'confirmed';

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">
        {confirmed
          ? 'Dziękujemy za rezerwację!'
          : 'Oczekiwanie na potwierdzenie'}
      </h1>
      <p className="text-lg mb-6">
        Rezerwacja <strong>{booking.booking_reference}</strong> na warsztat{' '}
        <strong>{session.workshops.title}</strong> ({date}).
      </p>
      <p className="mb-6">
        Kwota: {formatPrice(booking.total_price_gross_grosz)} · Liczba miejsc:{' '}
        {booking.quantity}
      </p>
      <p className="text-muted-foreground">
        Potwierdzenie zostało wysłane na adres {profile.email}. Jeśli wiadomość
        nie dotrze w ciągu kilku minut, sprawdź folder spam.
      </p>
      {!confirmed && (
        <p className="mt-4 text-sm">
          Status płatności jest aktualizowany automatycznie. Nie zamykaj tej
          strony przed otrzymaniem potwierdzenia e-mail.
        </p>
      )}
    </main>
  );
}
