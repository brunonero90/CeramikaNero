import { createAdminClient } from '@/lib/supabase/admin';

export default async function CancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const { reference } = await searchParams;

  let title = 'Rezerwacja została anulowana';
  if (reference) {
    const supabase = createAdminClient();
    const { data: booking } = await supabase
      .from('bookings')
      .select('booking_reference')
      .eq('booking_reference', reference)
      .maybeSingle();
    if (booking) {
      title = `Rezerwacja ${booking.booking_reference} została anulowana`;
    }
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      <p className="text-lg mb-6">
        Nie dokonano płatności, więc rezerwacja nie została potwierdzona. Jeśli
        chcesz spróbować ponownie, wróć do strony warsztatu.
      </p>
    </main>
  );
}
