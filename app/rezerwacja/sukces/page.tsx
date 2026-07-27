import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatPrice } from '@/lib/utils/price';
import { isBookingLocalMode } from '@/lib/booking/local-mode';

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    reference?: string;
    payment?: string;
  }>;
}) {
  const { session_id, reference, payment } = await searchParams;

  if (!session_id && !reference) {
    notFound();
  }

  if (isBookingLocalMode()) {
    if (!reference) notFound();
    const { getLocalBookingByReference, getLocalSession } =
      await import('@/lib/booking/local-store');
    const booking = await getLocalBookingByReference(reference);
    if (!booking) notFound();
    const session = await getLocalSession(booking.sessionId);
    const date = session
      ? new Intl.DateTimeFormat('pl-PL', {
          timeZone: 'Europe/Warsaw',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(session.startsAt))
      : 'termin';

    return (
      <main className="container mx-auto px-4 py-16">
        <h1 className="mb-4 text-3xl font-bold">Dziękujemy za rezerwację!</h1>
        <p className="mb-6 text-lg">
          Rezerwacja <strong>{booking.bookingReference}</strong>
          {session ? (
            <>
              {' '}
              na warsztat <strong>{session.workshopTitle}</strong> ({date}).
            </>
          ) : null}
        </p>
        <p className="mb-2">
          Liczba miejsc: <strong>{booking.quantity}</strong>
        </p>
        <p className="mb-6">
          Kwota: <strong>{formatPrice(booking.totalPriceGrossGrosz)}</strong>
        </p>
        <p className="mb-6 text-sm text-text-muted">
          Potwierdzenie zapisano w lokalnym outboxie e-mail (
          <code>tmp/local-booking</code>). Produkcyjna baza nie została
          zmieniona.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/kalendarz"
            className="inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold text-white uppercase"
          >
            Kalendarz
          </Link>
          <Link
            href="/admin/local"
            className="inline-flex border border-accent-primary px-5 py-3 text-sm font-semibold text-accent-primary uppercase"
          >
            Panel lokalny
          </Link>
        </div>
      </main>
    );
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
      'booking_reference, status, quantity, total_price_gross_grosz, customer_profiles(email), workshop_sessions!workshop_session_id(starts_at, workshops(title))'
    )
    .eq('booking_reference', bookingReference)
    .single();

  if (!booking) {
    notFound();
  }

  const session = booking.workshop_sessions as unknown as {
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
  const awaitingTransfer =
    payment === 'bank_transfer' || booking.status === 'awaiting_payment';

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="mb-4 text-3xl font-bold">
        {confirmed
          ? 'Dziękujemy za rezerwację!'
          : awaitingTransfer
            ? 'Rezerwacja przyjęta — oczekuje na płatność'
            : 'Oczekiwanie na potwierdzenie'}
      </h1>
      <p className="mb-6 text-lg">
        Rezerwacja <strong>{booking.booking_reference}</strong> na warsztat{' '}
        <strong>{session.workshops.title}</strong> ({date}).
      </p>
      <p className="mb-6">
        Liczba miejsc: <strong>{booking.quantity}</strong>. Kwota:{' '}
        <strong>{formatPrice(booking.total_price_gross_grosz)}</strong>.
      </p>
      {awaitingTransfer ? (
        <div className="mb-6 rounded border border-surface-subtle bg-surface-raised p-4 text-sm leading-relaxed">
          <p className="font-semibold">Instrukcja płatności</p>
          <p className="mt-2">
            Opłać udział przelewem lub BLIKIEM na konto:{' '}
            <strong>30 1140 2004 0000 3102 8314 9467</strong>.
          </p>
          <p className="mt-2">
            W tytule przelewu podaj numer rezerwacji{' '}
            <strong>{booking.booking_reference}</strong> oraz imię i nazwisko.
          </p>
          <p className="mt-2 text-text-muted">
            Miejsce jest zarezerwowane. Po zaksięgowaniu wpłaty potwierdzimy
            udział.
          </p>
        </div>
      ) : confirmed ? (
        <p className="text-muted-foreground text-sm">
          Potwierdzenie zostało wysłane na adres e-mail podany w formularzu (gdy
          dostawca e-mail jest skonfigurowany).
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Płatność jest weryfikowana. Ta strona nie potwierdza rezerwacji —
          potwierdzenie miejsca następuje dopiero po pozytywnej weryfikacji
          płatności. Odśwież za chwilę lub sprawdź skrzynkę e-mail.
        </p>
      )}
      <Link
        href="/kalendarz"
        className="mt-4 inline-flex bg-accent-primary px-5 py-3 text-sm font-semibold text-white uppercase"
      >
        Wróć do kalendarza
      </Link>
    </main>
  );
}
