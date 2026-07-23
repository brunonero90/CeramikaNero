import 'server-only';
import {
  getResendClient,
  getResendFromEmail,
  getResendReplyToEmail,
} from '@/lib/resend/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCancellationUrl } from '@/lib/booking/urls';
import { formatPrice } from '@/lib/utils/price';
import { addHours } from 'date-fns';
import { emailStatusSchema, emailTypeSchema } from '@/lib/database/schema';

export type BookingEmailType =
  (typeof emailTypeSchema.enum)[keyof typeof emailTypeSchema.enum];
export type BookingEmailStatus =
  (typeof emailStatusSchema.enum)[keyof typeof emailStatusSchema.enum];

type BookingEmailContext = {
  bookingId: string;
  reference: string;
  workshopTitle: string;
  sessionStartsAt: string;
  sessionLocation: string;
  quantity: number;
  totalGrossGrosz: number;
  customerEmail: string;
  customerName: string;
  participants: { display_name: string | null; age: number | null }[];
};

export async function getBookingEmailContext(
  bookingId: string
): Promise<BookingEmailContext | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `
      id,
      booking_reference,
      quantity,
      total_price_gross_grosz,
      customer_profiles!inner (first_name, last_name, email),
      workshop_sessions!inner (starts_at, location_name, location_address, workshops!inner (title)),
      booking_participants (display_name, age)
    `
    )
    .eq('id', bookingId)
    .single();

  if (error || !data) {
    console.error('getBookingEmailContext failed', error);
    return null;
  }

  const profile = data.customer_profiles as {
    first_name: string;
    last_name: string;
    email: string;
  };
  const session = data.workshop_sessions as {
    starts_at: string;
    location_name: string | null;
    location_address: string | null;
    workshops: { title: string };
  };
  const participants = (data.booking_participants ?? []) as {
    display_name: string | null;
    age: number | null;
  }[];

  return {
    bookingId: data.id as string,
    reference: data.booking_reference as string,
    workshopTitle: session.workshops.title,
    sessionStartsAt: session.starts_at,
    sessionLocation: [session.location_name, session.location_address]
      .filter(Boolean)
      .join(', '),
    quantity: data.quantity as number,
    totalGrossGrosz: data.total_price_gross_grosz as number,
    customerEmail: profile.email,
    customerName: `${profile.first_name} ${profile.last_name}`.trim(),
    participants,
  };
}

function formatWarsawDate(iso: string): string {
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

export async function recordBookingEmail(
  bookingId: string,
  type: BookingEmailType,
  status: BookingEmailStatus,
  providerMessageId?: string | null,
  errorMessage?: string | null
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('record_booking_email', {
    p_booking_id: bookingId,
    p_email_type: type,
    p_status: status,
    p_provider_message_id: providerMessageId ?? null,
    p_error_message: errorMessage ?? null,
  });
  if (error || !data) {
    console.error('record_booking_email failed', error);
    return null;
  }
  return data as string;
}

async function hasSuccessfulEmail(
  bookingId: string,
  type: BookingEmailType
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('booking_emails')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('email_type', type)
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function sendBookingConfirmationEmail(
  ctx: BookingEmailContext
): Promise<void> {
  if (await hasSuccessfulEmail(ctx.bookingId, 'confirmation')) {
    return;
  }

  const supabase = createAdminClient();
  const { data: token } = await supabase.rpc('create_cancellation_token', {
    p_booking_id: ctx.bookingId,
    p_expires_at: addHours(new Date(ctx.sessionStartsAt), -24).toISOString(),
  });

  const cancellationUrl = token
    ? buildCancellationUrl(token as string, ctx.reference)
    : undefined;

  const subject = `Potwierdzenie rezerwacji ${ctx.reference}`;
  const amount = formatPrice(ctx.totalGrossGrosz);
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const participantList = ctx.participants
    .map(
      (p, i) =>
        `${i + 1}. ${p.display_name ?? 'Uczestnik'}${p.age ? ` (${p.age} l.)` : ''}`
    )
    .join('\n');

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Potwierdzenie rezerwacji</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Twoja rezerwacja <strong>${ctx.reference}</strong> została potwierdzona.</p>
      <h2>Szczegóły warsztatu</h2>
      <p><strong>${ctx.workshopTitle}</strong><br>Data: ${date}<br>Liczba miejsc: ${ctx.quantity}<br>Kwota: ${amount}</p>
      ${ctx.sessionLocation ? `<p>Miejsce: ${ctx.sessionLocation}</p>` : ''}
      <h2>Uczestnicy</h2>
      <p>${participantList.replace(/\n/g, '<br>')}</p>
      ${cancellationUrl ? `<p><a href="${cancellationUrl}">Anuluj rezerwację</a> (możliwe do 24 h przed warsztatem)</p>` : ''}
      <p>Do zobaczenia!<br>Ceramika Nero</p>
    </div>
  `;

  const text = `Potwierdzenie rezerwacji ${ctx.reference}\n\nDzień dobry ${ctx.customerName},\n\nTwoja rezerwacja została potwierdzona.\n\nWarsztat: ${ctx.workshopTitle}\nData: ${date}\nLiczba miejsc: ${ctx.quantity}\nKwota: ${amount}\n${ctx.sessionLocation ? `Miejsce: ${ctx.sessionLocation}\n` : ''}\nUczestnicy:\n${participantList}\n\n${cancellationUrl ? `Anuluj rezerwację: ${cancellationUrl}\n` : ''}\nDo zobaczenia!\nCeramika Nero`;

  await sendEmail(
    ctx.customerEmail,
    subject,
    html,
    text,
    ctx.bookingId,
    'confirmation'
  );
}

export async function sendBookingCancellationEmail(
  ctx: BookingEmailContext,
  reason?: string
): Promise<void> {
  if (await hasSuccessfulEmail(ctx.bookingId, 'cancellation')) {
    return;
  }
  const subject = `Rezerwacja ${ctx.reference} została anulowana`;
  const amount = formatPrice(ctx.totalGrossGrosz);
  const date = formatWarsawDate(ctx.sessionStartsAt);
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Rezerwacja anulowana</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Rezerwacja <strong>${ctx.reference}</strong> na warsztat <strong>${ctx.workshopTitle}</strong> (${date}) została anulowana.</p>
      <p>Kwota: ${amount}</p>
      ${reason ? `<p>Powód: ${reason}</p>` : ''}
      <p>W przypadku zwrotu środki pojawią się na koncie w ciągu kilku dni roboczych.</p>
      <p>Ceramika Nero</p>
    </div>
  `;
  const text = `Rezerwacja anulowana\n\nRezerwacja ${ctx.reference} na ${ctx.workshopTitle} (${date}) została anulowana.\nKwota: ${amount}\n${reason ? `Powód: ${reason}\n` : ''}W przypadku zwrotu środki pojawią się na koncie w ciągu kilku dni roboczych.\n\nCeramika Nero`;
  await sendEmail(
    ctx.customerEmail,
    subject,
    html,
    text,
    ctx.bookingId,
    'cancellation'
  );
}

export async function sendRefundEmail(
  ctx: BookingEmailContext,
  refundAmountGrosz: number
): Promise<void> {
  if (await hasSuccessfulEmail(ctx.bookingId, 'refund')) {
    return;
  }
  const subject = `Zwrot środków za rezerwację ${ctx.reference}`;
  const amount = formatPrice(refundAmountGrosz);
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Zwrot środków</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Na Twoje konto został zwrócony zwrot w wysokości <strong>${amount}</strong> za rezerwację <strong>${ctx.reference}</strong>.</p>
      <p>Środki powinny pojawić się w ciągu kilku dni roboczych.</p>
      <p>Ceramika Nero</p>
    </div>
  `;
  const text = `Zwrot środków\n\nNa Twoje konto został zwrócony zwrot ${amount} za rezerwację ${ctx.reference}.\nŚrodki powinny pojawić się w ciągu kilku dni roboczych.\n\nCeramika Nero`;
  await sendEmail(
    ctx.customerEmail,
    subject,
    html,
    text,
    ctx.bookingId,
    'refund'
  );
}

export async function sendPaymentProblemEmail(
  ctx: BookingEmailContext
): Promise<void> {
  const subject = `Wymagana interwencja – rezerwacja ${ctx.reference}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Płatność wymaga uwagi</h1>
      <p>Dzień dobry ${ctx.customerName},</p>
      <p>Twoja płatność za rezerwację <strong>${ctx.reference}</strong> została przyjęta, ale wymagana jest interwencja administracyjna. Skontaktujemy się z Tobą w ciągu 24 godzin.</p>
      <p>Ceramika Nero</p>
    </div>
  `;
  const text = `Płatność wymaga uwagi\n\nTwoja płatność za rezerwację ${ctx.reference} została przyjęta, ale wymagana jest interwencja administracyjna. Skontaktujemy się z Tobą w ciągu 24 godzin.\n\nCeramika Nero`;
  await sendEmail(
    ctx.customerEmail,
    subject,
    html,
    text,
    ctx.bookingId,
    'payment_problem'
  );
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  bookingId: string,
  type: BookingEmailType
): Promise<void> {
  const resend = getResendClient();
  const from = getResendFromEmail();
  const replyTo = getResendReplyToEmail();

  const recordId = await recordBookingEmail(bookingId, type, 'pending');

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo,
      subject,
      html,
      text,
    });

    if (error) {
      await recordBookingEmail(bookingId, type, 'failed', null, error.message);
      throw error;
    }

    await recordBookingEmail(bookingId, type, 'sent', data?.id ?? null, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error';
    if (recordId) {
      await recordBookingEmail(bookingId, type, 'failed', null, message);
    }
    // Email failure must not roll back a successful payment. Just log and surface.
    console.error('Email send failed', { bookingId, type, error: message });
  }
}
