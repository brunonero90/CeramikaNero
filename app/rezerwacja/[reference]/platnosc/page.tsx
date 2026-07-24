import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeServerClient } from '@/lib/stripe/server';

export default async function PaymentRedirectPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, status, booking_reference, payments(id, provider_checkout_id, status)'
    )
    .eq('booking_reference', reference)
    .single();

  if (!booking) {
    notFound();
  }

  const payments = booking.payments as
    | { id: string; provider_checkout_id: string | null; status: string }[]
    | null;
  const payment = payments?.[0];

  if (booking.status === 'confirmed') {
    redirect(
      '/rezerwacja/sukces?reference=' +
        encodeURIComponent(booking.booking_reference)
    );
  }

  if (booking.status === 'cancelled' || booking.status === 'expired') {
    redirect(
      '/rezerwacja/anulowana?reference=' +
        encodeURIComponent(booking.booking_reference)
    );
  }

  if (payment?.provider_checkout_id) {
    const stripe = getStripeServerClient();
    const session = await stripe.checkout.sessions.retrieve(
      payment.provider_checkout_id
    );
    if (session.url) {
      redirect(session.url);
    }
  }

  redirect(
    '/rezerwacja/anulowana?reference=' +
      encodeURIComponent(booking.booking_reference)
  );
}
