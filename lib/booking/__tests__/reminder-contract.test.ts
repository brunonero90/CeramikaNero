import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('booking reminder production contract', () => {
  const netlify = source('netlify.toml');
  const scheduledFunction = source('netlify/functions/booking-email-dispatch.js');
  const dispatch = source('lib/booking/email-dispatch.ts');
  const migration = source(
    'supabase/migrations/00000000000026_linked_workshops_and_reminders.sql'
  );

  it('runs the authenticated email dispatcher every five minutes', () => {
    expect(netlify).toContain('function = "booking-email-dispatch"');
    expect(netlify).toContain('schedule = "*/5 * * * *"');
    expect(scheduledFunction).toContain('BOOKING_CRON_SECRET');
    expect(scheduledFunction).toContain('/api/cron/email-dispatch');
  });

  it('queues one reminder approximately 24 hours before a confirmed session', () => {
    expect(dispatch).toContain(".rpc('enqueue_booking_reminders'");
    expect(dispatch).toContain("'confirmation', 'admin_notification', 'reminder'");
    expect(migration).toContain("v_now + interval '23 hours'");
    expect(migration).toContain("v_now + interval '25 hours'");
    expect(migration).toContain('idx_booking_emails_one_reminder');
    expect(migration).toContain("b.status = 'confirmed'");
  });

  it('rechecks cancellation/refund eligibility and records reminder outcomes', () => {
    expect(dispatch).toContain("booking.status !== 'confirmed'");
    expect(dispatch).toContain("event_type: 'reminder_skipped'");
    expect(dispatch).toContain("event_type: 'reminder_sent'");
    expect(dispatch).toContain("console.info('[booking-reminder] sent'");
    expect(migration).toContain(
      "b.status in ('cancelled', 'expired', 'refunded', 'partially_refunded')"
    );
  });
});
