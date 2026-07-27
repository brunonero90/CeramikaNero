import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCancellationUrl } from '@/lib/booking/urls';
import { addHours } from 'date-fns';
import { emailStatusSchema, emailTypeSchema } from '@/lib/database/schema';
import { deliverBookingEmail } from '@/lib/booking/email-transport';
import { isBookingLocalMode } from '@/lib/booking/local-mode';
import {
  buildAdminNotificationEmail,
  buildCustomerConfirmationEmail,
  getBookingAdminEmail,
  getPublicSiteUrl,
  type BookingEmailTemplateContext,
} from '@/lib/booking/email-templates';

export type BookingEmailType =
  (typeof emailTypeSchema.enum)[keyof typeof emailTypeSchema.enum];
export type BookingEmailStatus =
  (typeof emailStatusSchema.enum)[keyof typeof emailStatusSchema.enum];

type BookingEmailContext = BookingEmailTemplateContext & {
  bookingId: string;
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
      unit_price_gross_grosz,
      total_price_gross_grosz,
      customer_notes,
      customer_profiles!inner (first_name, last_name, email, phone),
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
    phone: string | null;
  };
  const session = data.workshop_sessions as unknown as {
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
    unitPriceGrossGrosz: data.unit_price_gross_grosz as number,
    totalGrossGrosz: data.total_price_gross_grosz as number,
    customerEmail: profile.email,
    customerName: `${profile.first_name} ${profile.last_name}`.trim(),
    customerPhone: profile.phone,
    customerNotes: (data.customer_notes as string | null) ?? null,
    participants,
    siteUrl: getPublicSiteUrl(),
  };
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
    p_provider_message_id: providerMessageId ?? undefined,
  });
  if (error || !data) {
    console.error('record_booking_email failed', error);
    return null;
  }

  // Best-effort: attach error message / retry metadata when columns exist.
  if (errorMessage || status === 'pending' || status === 'failed') {
    const patch = await supabase
      .from('booking_emails')
      .update({
        error_message: errorMessage ?? null,
        next_attempt_at:
          status === 'failed' || status === 'pending'
            ? new Date(Date.now() + 60_000).toISOString()
            : null,
      })
      .eq('id', data as string);
    if (patch.error && errorMessage) {
      await supabase
        .from('booking_emails')
        .update({ error_message: errorMessage })
        .eq('id', data as string);
    }
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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  bookingId: string,
  type: BookingEmailType
): Promise<void> {
  if (!isBookingLocalMode()) {
    await recordBookingEmail(bookingId, type, 'pending');
  }

  const result = await deliverBookingEmail({
    bookingId,
    type,
    to,
    subject,
    html,
    text,
  });

  if (!isBookingLocalMode()) {
    if (result.ok) {
      await recordBookingEmail(
        bookingId,
        type,
        'sent',
        result.providerMessageId,
        null
      );
    } else {
      await recordBookingEmail(
        bookingId,
        type,
        'failed',
        null,
        result.errorMessage
      );
      console.error('Email send failed', {
        bookingId,
        type,
        error: result.errorMessage,
      });
    }
  }
}

export async function sendBookingConfirmationEmail(
  ctx: BookingEmailContext
): Promise<void> {
  if (!isBookingLocalMode()) {
    if (await hasSuccessfulEmail(ctx.bookingId, 'confirmation')) {
      return;
    }
  }

  let cancellationUrl: string | undefined;
  if (!isBookingLocalMode()) {
    const supabase = createAdminClient();
    const { data: token } = await supabase.rpc('create_cancellation_token', {
      p_booking_id: ctx.bookingId,
      p_expires_at: addHours(new Date(ctx.sessionStartsAt), -24).toISOString(),
    });
    cancellationUrl = token
      ? buildCancellationUrl(token as string, ctx.reference)
      : undefined;
  } else {
    cancellationUrl = `${getPublicSiteUrl()}/kontakt`;
  }

  const content = buildCustomerConfirmationEmail({
    ...ctx,
    cancellationUrl,
  });

  await sendEmail(
    ctx.customerEmail,
    content.subject,
    content.html,
    content.text,
    ctx.bookingId,
    'confirmation'
  );
}

export async function sendAdminBookingNotificationEmail(
  ctx: BookingEmailContext
): Promise<void> {
  const adminTo = getBookingAdminEmail();
  if (!adminTo) {
    console.info(
      '[email] BOOKING_ADMIN_EMAIL not set; skipping admin notification',
      { bookingId: ctx.bookingId }
    );
    return;
  }

  if (!isBookingLocalMode()) {
    if (await hasSuccessfulEmail(ctx.bookingId, 'admin_notification')) {
      return;
    }
  }

  const content = buildAdminNotificationEmail(ctx);
  await sendEmail(
    adminTo,
    content.subject,
    content.html,
    content.text,
    ctx.bookingId,
    'admin_notification'
  );
}

/** Queue customer + admin emails after a successful booking write. */
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  const ctx = await getBookingEmailContext(bookingId);
  if (!ctx) return;
  try {
    await sendBookingConfirmationEmail(ctx);
  } catch (error) {
    console.error('customer confirmation email failed', {
      bookingId,
      error: error instanceof Error ? error.message : error,
    });
  }
  try {
    await sendAdminBookingNotificationEmail(ctx);
  } catch (error) {
    console.error('admin notification email failed', {
      bookingId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function sendBookingCancellationEmail(
  ctx: BookingEmailContext,
  reason?: string
): Promise<void> {
  if (await hasSuccessfulEmail(ctx.bookingId, 'cancellation')) {
    return;
  }
  const { buildCancellationEmail } =
    await import('@/lib/booking/email-templates');
  const content = buildCancellationEmail(ctx, reason);
  await sendEmail(
    ctx.customerEmail,
    content.subject,
    content.html,
    content.text,
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
  const { formatPrice } = await import('@/lib/utils/price');
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

/** Build confirmation content for local bookings (no Supabase context). */
export async function sendLocalBookingConfirmationEmail(params: {
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
}): Promise<void> {
  await sendBookingConfirmationEmail({
    bookingId: params.bookingId,
    reference: params.reference,
    workshopTitle: params.workshopTitle,
    sessionStartsAt: params.sessionStartsAt,
    sessionLocation: params.sessionLocation,
    quantity: params.quantity,
    unitPriceGrossGrosz:
      params.quantity > 0
        ? Math.round(params.totalGrossGrosz / params.quantity)
        : params.totalGrossGrosz,
    totalGrossGrosz: params.totalGrossGrosz,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    customerPhone: null,
    customerNotes: null,
    participants: params.participants,
    siteUrl: getPublicSiteUrl(),
  });
}
