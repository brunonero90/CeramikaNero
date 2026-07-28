import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCancellationUrl } from '@/lib/booking/urls';
import { addHours } from 'date-fns';
import { emailStatusSchema, emailTypeSchema } from '@/lib/database/schema';
import { deliverBookingEmail } from '@/lib/booking/email-transport';
import { isBookingLocalMode } from '@/lib/booking/local-mode';
import {
  getBookingAdminEmail,
  getPublicSiteUrl,
  type BookingEmailTemplateContext,
} from '@/lib/booking/email-templates';
import { buildBookingEmail } from '@/lib/email/catalog';
import { renderEmail } from '@/lib/email/render';
import type { BookingEmailContext as CatalogBookingContext } from '@/lib/email/types';
import {
  loadBankTransferConfig,
  buildTransferTitle,
  formatBankAccountForDisplay,
} from '@/lib/payments/bank-transfer';

export type BookingEmailType =
  (typeof emailTypeSchema.enum)[keyof typeof emailTypeSchema.enum];
export type BookingEmailStatus =
  (typeof emailStatusSchema.enum)[keyof typeof emailStatusSchema.enum];

type BookingEmailContext = BookingEmailTemplateContext & {
  bookingId: string;
};

function toCatalogContext(
  ctx: BookingEmailContext,
  extras?: Partial<CatalogBookingContext>
): CatalogBookingContext {
  return {
    reference: ctx.reference,
    workshopTitle: ctx.workshopTitle,
    sessionStartsAt: ctx.sessionStartsAt,
    sessionLocation: ctx.sessionLocation,
    quantity: ctx.quantity,
    unitPriceGrosz: ctx.unitPriceGrossGrosz,
    totalGrosz: ctx.totalGrossGrosz,
    customerName: ctx.customerName,
    customerEmail: ctx.customerEmail,
    customerPhone: ctx.customerPhone,
    customerNotes: ctx.customerNotes,
    participants: ctx.participants.map((p) => ({
      displayName: p.display_name,
      age: p.age,
    })),
    cancellationUrl: ctx.cancellationUrl,
    siteUrl: ctx.siteUrl,
    ...extras,
  };
}

async function bankPaymentForBooking(
  reference: string,
  amountGrosz: number
): Promise<CatalogBookingContext['payment']> {
  const bank = await loadBankTransferConfig();
  if (!bank.ok) return { mode: 'none' };
  return {
    mode: 'bank_transfer',
    details: {
      recipient: bank.config.recipient,
      accountNumber: formatBankAccountForDisplay(bank.config.accountNumber),
      title: buildTransferTitle(bank.config.titleTemplate, reference),
      amountGrosz,
      bankName: bank.config.bankName,
      deadlineNote: bank.config.deadlineNote,
      extraInstructions: bank.config.extraInstructions,
    },
  };
}

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

  const payment = await bankPaymentForBooking(
    ctx.reference,
    ctx.totalGrossGrosz
  );
  const catalogCtx = toCatalogContext({ ...ctx, cancellationUrl }, { payment });
  const rendered = await renderEmail(
    buildBookingEmail('confirmation', catalogCtx)
  );

  await sendEmail(
    ctx.customerEmail,
    rendered.subject,
    rendered.html,
    rendered.text,
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

  const catalogCtx = toCatalogContext(ctx);
  const rendered = await renderEmail(
    buildBookingEmail('admin_notification', catalogCtx)
  );
  await sendEmail(
    adminTo,
    rendered.subject,
    rendered.html,
    rendered.text,
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
  const catalogCtx = toCatalogContext(ctx, { reason: reason ?? null });
  const rendered = await renderEmail(
    buildBookingEmail('cancellation', catalogCtx)
  );
  await sendEmail(
    ctx.customerEmail,
    rendered.subject,
    rendered.html,
    rendered.text,
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
  const catalogCtx = toCatalogContext(ctx, {
    refundAmountGrosz,
  });
  const rendered = await renderEmail(buildBookingEmail('refund', catalogCtx));
  await sendEmail(
    ctx.customerEmail,
    rendered.subject,
    rendered.html,
    rendered.text,
    ctx.bookingId,
    'refund'
  );
}

export async function sendPaymentProblemEmail(
  ctx: BookingEmailContext
): Promise<void> {
  const catalogCtx = toCatalogContext(ctx);
  const rendered = await renderEmail(
    buildBookingEmail('payment_problem', catalogCtx)
  );
  await sendEmail(
    ctx.customerEmail,
    rendered.subject,
    rendered.html,
    rendered.text,
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
