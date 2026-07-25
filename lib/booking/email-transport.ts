import 'server-only';
import { isBookingLocalMode, isResendConfigured } from './local-mode';
import {
  getResendClient,
  getResendFromEmail,
  getResendReplyToEmail,
} from '@/lib/resend/server';

export type OutboundEmail = {
  bookingId: string;
  type: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = {
  ok: boolean;
  provider: 'resend' | 'local_outbox' | 'ledger';
  providerMessageId: string | null;
  errorMessage: string | null;
};

/**
 * Sends via Resend when configured.
 * In development / BOOKING_LOCAL_MODE, writes a file outbox.
 * In production without Resend, returns a soft failure so the booking path
 * can still persist a `booking_emails` ledger row as pending/failed.
 */
export async function deliverBookingEmail(
  email: OutboundEmail
): Promise<SendEmailResult> {
  if (isResendConfigured()) {
    try {
      const resend = getResendClient();
      const from = getResendFromEmail();
      const replyTo = getResendReplyToEmail();
      const { data, error } = await resend.emails.send({
        from,
        to: email.to,
        replyTo,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      if (error) {
        return {
          ok: false,
          provider: 'resend',
          providerMessageId: null,
          errorMessage: error.message,
        };
      }
      return {
        ok: true,
        provider: 'resend',
        providerMessageId: data?.id ?? null,
        errorMessage: null,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'resend',
        providerMessageId: null,
        errorMessage: err instanceof Error ? err.message : 'Unknown email error',
      };
    }
  }

  if (isBookingLocalMode() || process.env.NODE_ENV !== 'production') {
    try {
      const { appendLocalOutbox } = await import('./local-store');
      const record = await appendLocalOutbox({
        bookingId: email.bookingId,
        type: email.type,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        status: 'sent',
        providerMessageId: `outbox-${Date.now()}`,
        errorMessage: null,
      });
      console.info('[email-outbox]', {
        id: record.id,
        to: email.to,
        subject: email.subject,
        type: email.type,
        bookingId: email.bookingId,
      });
      return {
        ok: true,
        provider: 'local_outbox',
        providerMessageId: record.providerMessageId,
        errorMessage: null,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'local_outbox',
        providerMessageId: null,
        errorMessage: err instanceof Error ? err.message : 'Outbox write failed',
      };
    }
  }

  console.warn(
    '[email] RESEND is not configured in production; confirmation recorded in booking_emails ledger only.',
    { bookingId: email.bookingId, type: email.type, to: email.to }
  );
  return {
    ok: false,
    provider: 'ledger',
    providerMessageId: null,
    errorMessage: 'RESEND_API_KEY / RESEND_FROM_EMAIL not configured',
  };
}
