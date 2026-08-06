import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverBookingEmail } from '@/lib/booking/email-transport';
import { isResendConfigured } from '@/lib/booking/local-mode';
import {
  getBookingEmailContext,
  type BookingEmailType,
} from '@/lib/booking/email';
import {
  buildAdminNotificationEmail,
  buildCustomerConfirmationEmail,
  buildReminderEmail,
  getBookingAdminEmail,
} from '@/lib/booking/email-templates';
import { emailTypeSchema } from '@/lib/database/schema';
import type { Database } from '@/lib/database/types';

const MAX_ATTEMPTS = 8;

function backoffMs(attemptCount: number): number {
  const minutes = Math.min(60, Math.pow(2, Math.max(0, attemptCount)));
  return minutes * 60_000;
}

function isPermanentFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return /invalid.*(api|key|from|domain)|domain.*not.*verif|permanent|blocked/i.test(
    message
  );
}

export type DispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  resendConfigured: boolean;
  remindersQueued: number;
};

type ClaimedEmail = {
  id: string;
  booking_id: string;
  email_type: string;
  attempt_count: number | null;
  status: string;
};

/** Typed update payload for booking_emails retry metadata. */
function emailRowUpdate(
  values: Database['public']['Tables']['booking_emails']['Update']
) {
  return values;
}

async function buildPayload(row: ClaimedEmail): Promise<{
  to: string;
  subject: string;
  html: string;
  text: string;
} | null> {
  const type = emailTypeSchema.parse(row.email_type) as BookingEmailType;
  const ctx = await getBookingEmailContext(row.booking_id);
  if (!ctx) return null;

  if (type === 'confirmation') {
    return {
      to: ctx.customerEmail,
      ...buildCustomerConfirmationEmail(ctx),
    };
  }
  if (type === 'reminder') {
    return {
      to: ctx.customerEmail,
      ...buildReminderEmail(ctx),
    };
  }
  if (type === 'admin_notification') {
    const adminTo = getBookingAdminEmail();
    if (!adminTo) return null;
    return {
      to: adminTo,
      ...buildAdminNotificationEmail(ctx),
    };
  }
  // Other types are sent on their primary event paths; worker focuses on
  // confirmation + admin notification retries for launch readiness.
  return null;
}

export async function dispatchPendingBookingEmails(
  limit = 20
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    resendConfigured: isResendConfigured(),
    remindersQueued: 0,
  };

  const supabase = createAdminClient();
  const reminderQueue = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{
        data: { queued?: number } | null;
        error: { message: string } | null;
      }>;
    }
  ).rpc('enqueue_booking_reminders', {
    p_window_start: null,
    p_window_end: null,
  });
  if (reminderQueue.error) {
    console.warn(
      'enqueue_booking_reminders failed',
      reminderQueue.error.message
    );
  } else {
    summary.remindersQueued = Number(reminderQueue.data?.queued ?? 0);
  }
  // RPC added in migration 00000000000010_booking_email_admin_retry.
  let rows: ClaimedEmail[] = [];
  const claimed = await supabase.rpc(
    'claim_booking_emails_for_dispatch' as never,
    {
      p_limit: limit,
      p_claim_seconds: 120,
    } as never
  );

  if (claimed.error) {
    console.warn(
      'claim_booking_emails_for_dispatch unavailable; using select fallback',
      claimed.error.message
    );
    const fallback = await supabase
      .from('booking_emails')
      .select('id, booking_id, email_type, status')
      .in('status', ['pending', 'failed'])
      .in('email_type', ['confirmation', 'admin_notification', 'reminder'])
      .order('created_at', { ascending: true })
      .limit(limit);
    if (fallback.error) {
      console.error('email dispatch fallback select failed', fallback.error);
      throw new Error('Email claim failed');
    }
    rows = (
      (fallback.data ?? []) as Array<{
        id: string;
        booking_id: string;
        email_type: string;
        status: string;
      }>
    ).map((row) => ({
      ...row,
      attempt_count: 0,
    }));
  } else {
    rows = (claimed.data as unknown as ClaimedEmail[]) ?? [];
  }
  summary.claimed = rows.length;

  for (const row of rows) {
    if (row.email_type === 'reminder') {
      const eligibility = await supabase
        .from('bookings')
        .select('status, workshop_sessions!inner(starts_at, status)')
        .eq('id', row.booking_id)
        .maybeSingle();
      const booking = eligibility.data as unknown as {
        status: string;
        workshop_sessions: { starts_at: string; status: string };
      } | null;
      if (
        !booking ||
        booking.status !== 'confirmed' ||
        !['scheduled', 'sold_out'].includes(booking.workshop_sessions.status) ||
        booking.workshop_sessions.starts_at <= new Date().toISOString()
      ) {
        await supabase
          .from('booking_emails')
          .update(
            emailRowUpdate({
              status: 'failed',
              claimed_at: null,
              error_message:
                'permanent: booking no longer eligible for reminder',
              next_attempt_at: null,
            })
          )
          .eq('id', row.id);
        await supabase.from('booking_events').insert({
          booking_id: row.booking_id,
          event_type: 'reminder_skipped',
          actor_type: 'system',
          metadata: { reason: 'booking_not_eligible_at_dispatch' },
        } as never);
        summary.skipped += 1;
        continue;
      }
    }

    const attempts = (row.attempt_count ?? 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      await supabase
        .from('booking_emails')
        .update(
          emailRowUpdate({
            status: 'failed',
            claimed_at: null,
            error_message: 'permanent: max attempts exceeded',
            attempt_count: attempts,
            next_attempt_at: null,
          })
        )
        .eq('id', row.id);
      summary.failed += 1;
      continue;
    }

    // Idempotency: if another row for this booking/type already sent, close.
    const { data: alreadySent } = await supabase
      .from('booking_emails')
      .select('id')
      .eq('booking_id', row.booking_id)
      .eq('email_type', row.email_type)
      .eq('status', 'sent')
      .neq('id', row.id)
      .limit(1)
      .maybeSingle();

    if (alreadySent) {
      await supabase
        .from('booking_emails')
        .update(
          emailRowUpdate({
            status: 'sent',
            claimed_at: null,
            error_message: 'superseded by earlier successful send',
            attempt_count: attempts,
            next_attempt_at: null,
          })
        )
        .eq('id', row.id);
      summary.skipped += 1;
      continue;
    }

    const payload = await buildPayload(row);
    if (!payload) {
      await supabase
        .from('booking_emails')
        .update(
          emailRowUpdate({
            status: 'failed',
            claimed_at: null,
            error_message: 'permanent: cannot build payload for email type',
            attempt_count: attempts,
            next_attempt_at: null,
          })
        )
        .eq('id', row.id);
      summary.failed += 1;
      continue;
    }

    const result = await deliverBookingEmail({
      bookingId: row.booking_id,
      type: row.email_type,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (result.ok) {
      await supabase
        .from('booking_emails')
        .update(
          emailRowUpdate({
            status: 'sent',
            claimed_at: null,
            provider_message_id: result.providerMessageId,
            error_message: null,
            attempt_count: attempts,
            next_attempt_at: null,
            sent_at: new Date().toISOString(),
          })
        )
        .eq('id', row.id);
      if (row.email_type === 'reminder') {
        await supabase.from('booking_events').insert({
          booking_id: row.booking_id,
          event_type: 'reminder_sent',
          actor_type: 'system',
          metadata: { provider_message_id: result.providerMessageId ?? null },
        } as never);
        console.info('[booking-reminder] sent', {
          bookingId: row.booking_id,
          emailId: row.id,
          providerMessageId: result.providerMessageId ?? null,
        });
      }
      summary.sent += 1;
      continue;
    }

    const permanent = isPermanentFailure(result.errorMessage);
    await supabase
      .from('booking_emails')
      .update(
        emailRowUpdate({
          status: 'failed',
          claimed_at: null,
          error_message: permanent
            ? `permanent: ${result.errorMessage}`
            : result.errorMessage,
          attempt_count: attempts,
          next_attempt_at: permanent
            ? null
            : new Date(Date.now() + backoffMs(attempts)).toISOString(),
        })
      )
      .eq('id', row.id);
    summary.failed += 1;
  }

  return summary;
}
