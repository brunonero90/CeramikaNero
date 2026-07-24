import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database/types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const hasRemoteEnv = Boolean(url && secretKey && publishableKey);

/**
 * Phase 5 booking integration tests.
 *
 * These tests run against the real Supabase project and require the Phase 5
 * migration (00000000000005_booking_system.sql) to be applied first. They create
 * isolated test-owned records and delete only those exact records after the run.
 */
describe.skipIf(!hasRemoteEnv)('Phase 5 booking integration', () => {
  const admin = createClient<Database>(url!, secretKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient<Database>(url!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runId = `ph5-${Date.now()}`;
  const testPrefix = `PH5-${runId}`;

  const category = {
    name: `${testPrefix} category`,
    slug: `${testPrefix}-category`,
    suggested_theme: 'atelier',
  };
  const workshop = {
    title: `${testPrefix} workshop`,
    slug: `${testPrefix}-workshop`,
    description: 'Test workshop for Phase 5 integration.',
    short_description: 'Test',
    status: 'published',
    booking_mode: 'scheduled',
    default_price_gross_grosz: 10000,
    default_capacity: 10,
    default_duration_minutes: 120,
    currency: 'PLN',
  };

  let categoryId: string;
  let workshopId: string;
  let sessionId: string;
  let destinationSessionId: string;
  let customerId: string;
  const bookingIds: string[] = [];
  const paymentIds: string[] = [];
  let cancellationToken: string;
  const customerEmail = `${testPrefix}@example.com`;

  function future(hoursFromNow: number) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  }

  beforeAll(async () => {
    const { data: categoryRow, error: categoryError } = await admin
      .from('workshop_categories')
      .insert(category)
      .select('id')
      .single();
    expect(categoryError).toBeNull();
    categoryId = categoryRow!.id;

    const { data: workshopRow, error: workshopError } = await admin
      .from('workshops')
      .insert({ ...workshop, category_id: categoryId })
      .select('id')
      .single();
    expect(workshopError).toBeNull();
    workshopId = workshopRow!.id;

    const sessionBase = {
      workshop_id: workshopId,
      capacity: 10,
      price_gross_grosz: 10000,
      status: 'scheduled',
      starts_at: future(48),
      ends_at: future(50),
      booking_opens_at: future(-1),
      booking_closes_at: future(24),
      timezone: 'Europe/Warsaw',
      currency: 'PLN',
    };

    const { data: sessionRow, error: sessionError } = await admin
      .from('workshop_sessions')
      .insert(sessionBase)
      .select('id')
      .single();
    expect(sessionError).toBeNull();
    sessionId = sessionRow!.id;

    const { data: destinationRow, error: destinationError } = await admin
      .from('workshop_sessions')
      .insert({ ...sessionBase, starts_at: future(72), ends_at: future(74) })
      .select('id')
      .single();
    expect(destinationError).toBeNull();
    destinationSessionId = destinationRow!.id;
  });

  afterAll(async () => {
    // Delete only records created by this test run, in dependency-safe order.
    for (const paymentId of paymentIds) {
      await admin.from('payments').delete().eq('id', paymentId);
    }
    for (const bookingId of bookingIds) {
      await admin
        .from('booking_participants')
        .delete()
        .eq('booking_id', bookingId);
      await admin.from('booking_events').delete().eq('booking_id', bookingId);
      await admin
        .from('booking_cancellation_tokens')
        .delete()
        .eq('booking_id', bookingId);
      await admin.from('booking_emails').delete().eq('booking_id', bookingId);
      await admin.from('bookings').delete().eq('id', bookingId);
    }
    if (customerId) {
      await admin.from('customer_profiles').delete().eq('id', customerId);
    }
    if (destinationSessionId) {
      await admin
        .from('workshop_sessions')
        .delete()
        .eq('id', destinationSessionId);
    }
    if (sessionId) {
      await admin.from('workshop_sessions').delete().eq('id', sessionId);
    }
    if (workshopId) {
      await admin.from('workshops').delete().eq('id', workshopId);
    }
    if (categoryId) {
      await admin.from('workshop_categories').delete().eq('id', categoryId);
    }
  });

  function singleParticipant() {
    return [
      {
        display_name: 'Test Participant',
        age: '',
        participant_type: 'adult',
        accessibility_notes: '',
      },
    ];
  }

  async function beginFreshBooking(sessionIdOverride?: string) {
    const targetSessionId = sessionIdOverride ?? sessionId;
    const { data, error } = await admin.rpc('begin_booking', {
      p_session_id: targetSessionId,
      p_quantity: 1,
      p_customer_email: customerEmail,
      p_customer_first_name: 'Test',
      p_customer_last_name: 'Customer',
      p_customer_phone: '123456789',
      p_customer_notes: '',
      p_marketing_consent: false,
      p_terms_accepted_at: new Date().toISOString(),
      p_privacy_policy_version: 'v1',
      p_participants: singleParticipant(),
      p_source: 'integration-test',
      p_payment_provider: 'stripe',
      p_payment_status: 'created',
    });
    expect(error).toBeNull();
    const result = data as {
      booking_id: string;
      payment_id: string;
      booking_reference: string;
      total_price_gross_grosz: number;
      amount_to_pay_gross_grosz: number;
      currency: string;
      expires_at: string;
      confirmed_at: string | null;
    };
    bookingIds.push(result.booking_id);
    paymentIds.push(result.payment_id);
    return result;
  }

  it('atomically reserves capacity and creates participants', async () => {
    const { data: beforeSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    const beforeCount = beforeSession?.reserved_count ?? 0;

    const result = await beginFreshBooking();
    expect(result.total_price_gross_grosz).toBe(10000);
    expect(result.amount_to_pay_gross_grosz).toBe(10000);
    expect(result.currency).toBe('PLN');

    const { data: afterSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(afterSession?.reserved_count).toBe(beforeCount + 1);

    const { data: participants } = await admin
      .from('booking_participants')
      .select('*')
      .eq('booking_id', result.booking_id);
    expect(participants).toHaveLength(1);
    expect(participants?.[0].display_name).toBe('Test Participant');

    const { data: customer } = await admin
      .from('customer_profiles')
      .select('id, email')
      .eq('email', customerEmail)
      .single();
    expect(customer?.email).toBe(customerEmail.toLowerCase());
    customerId = customer!.id;
  });

  it('prevents concurrent booking attempts from overselling', async () => {
    // Use a small-capacity session to make the race deterministic.
    const { data: smallSessionRow } = await admin
      .from('workshop_sessions')
      .insert({
        workshop_id: workshopId,
        capacity: 2,
        price_gross_grosz: 10000,
        status: 'scheduled',
        starts_at: future(60),
        ends_at: future(62),
        booking_opens_at: future(-1),
        booking_closes_at: future(48),
        timezone: 'Europe/Warsaw',
        currency: 'PLN',
      })
      .select('id')
      .single();
    const smallSessionId = smallSessionRow!.id;

    const emailBase = `${testPrefix}-concurrent`;
    const attempts = Array.from({ length: 3 }).map((_, i) =>
      admin.rpc('begin_booking', {
        p_session_id: smallSessionId,
        p_quantity: 2,
        p_customer_email: `${emailBase}-${i}@example.com`,
        p_customer_first_name: 'Concurrent',
        p_customer_last_name: `User ${i}`,
        p_customer_phone: '123456789',
        p_customer_notes: '',
        p_marketing_consent: false,
        p_terms_accepted_at: new Date().toISOString(),
        p_privacy_policy_version: 'v1',
        p_participants: [
          {
            display_name: `User ${i} - A`,
            age: '',
            participant_type: 'adult',
            accessibility_notes: '',
          },
          {
            display_name: `User ${i} - B`,
            age: '',
            participant_type: 'adult',
            accessibility_notes: '',
          },
        ],
        p_source: 'integration-test-concurrent',
        p_payment_provider: 'stripe',
        p_payment_status: 'created',
      })
    );

    const results = await Promise.all(attempts);
    const successes = results.filter((r) => !r.error);
    expect(successes.length).toBeLessThanOrEqual(1);

    const { data: finalSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count, capacity')
      .eq('id', smallSessionId)
      .single();
    expect(finalSession?.reserved_count).toBeLessThanOrEqual(
      finalSession?.capacity ?? 0
    );

    for (const r of successes) {
      const result = r.data as {
        booking_id: string;
        payment_id: string;
      };
      bookingIds.push(result.booking_id);
      paymentIds.push(result.payment_id);
    }

    await admin.from('workshop_sessions').delete().eq('id', smallSessionId);
  });

  it('expires pending bookings and releases capacity exactly once', async () => {
    const result = await beginFreshBooking();

    // Manually set the booking to an expired state so the expiry function picks it up.
    await admin
      .from('bookings')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', result.booking_id);

    const { data: beforeSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    const beforeCount = beforeSession?.reserved_count ?? 0;

    const { data: expired } = await admin.rpc('expire_pending_bookings');
    const expiredRows = expired as {
      booking_id: string;
      booking_reference: string;
    }[];
    const expiredIds = expiredRows.map((row) => row.booking_id);
    expect(expiredIds).toContain(result.booking_id);

    const { data: afterBooking } = await admin
      .from('bookings')
      .select('status')
      .eq('id', result.booking_id)
      .single();
    expect(afterBooking?.status).toBe('expired');

    const { data: afterSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(afterSession?.reserved_count).toBe(beforeCount - 1);

    // Repeated expiry must be harmless and not decrement again.
    const { data: expiredAgain } = await admin.rpc('expire_pending_bookings');
    expect(expiredAgain).toHaveLength(0);

    const { data: finalSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(finalSession?.reserved_count).toBe(afterSession?.reserved_count);
  });

  it('confirms a booking from a verified payment only once', async () => {
    const result = await beginFreshBooking();
    const eventId = `${testPrefix}-evt-confirm-${result.booking_id}`;

    const { error: confirmError } = await admin.rpc(
      'confirm_booking_from_payment',
      {
        p_booking_id: result.booking_id,
        p_payment_id: result.payment_id,
        p_stripe_event_id: eventId,
        p_provider_payment_id: 'pi_test',
        p_amount_gross_grosz: 10000,
      }
    );
    expect(confirmError).toBeNull();

    const { data: booking } = await admin
      .from('bookings')
      .select('status')
      .eq('id', result.booking_id)
      .single();
    expect(booking?.status).toBe('confirmed');

    const { data: payment } = await admin
      .from('payments')
      .select('status')
      .eq('id', result.payment_id)
      .single();
    expect(payment?.status).toBe('paid');

    // Duplicate event idempotency: same event must not re-confirm or error.
    const { data: duplicateResult } = await admin.rpc(
      'confirm_booking_from_payment',
      {
        p_booking_id: result.booking_id,
        p_payment_id: result.payment_id,
        p_stripe_event_id: eventId,
        p_provider_payment_id: 'pi_test',
        p_amount_gross_grosz: 10000,
      }
    );
    const duplicateJson = duplicateResult as { already_processed?: boolean };
    expect(duplicateJson.already_processed).toBe(true);
  });

  it('returns manual resolution for a late payment on a terminal booking', async () => {
    const result = await beginFreshBooking();

    // Expire the booking manually.
    await admin
      .from('bookings')
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', result.booking_id);
    await admin.rpc('expire_pending_bookings');

    const { data: beforeSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count, capacity')
      .eq('id', sessionId)
      .single();
    // Fill the session so the expired booking cannot reacquire capacity.
    await admin
      .from('workshop_sessions')
      .update({ reserved_count: beforeSession!.capacity })
      .eq('id', sessionId);

    const eventId = `${testPrefix}-evt-late-${result.booking_id}`;
    const { data: confirmResult } = await admin.rpc(
      'confirm_booking_from_payment',
      {
        p_booking_id: result.booking_id,
        p_payment_id: result.payment_id,
        p_stripe_event_id: eventId,
        p_provider_payment_id: 'pi_test',
        p_amount_gross_grosz: 10000,
      }
    );
    const confirmJson = confirmResult as { status: string };
    expect(confirmJson.status).toBe('requires_manual_resolution');

    const { data: booking } = await admin
      .from('bookings')
      .select('status')
      .eq('id', result.booking_id)
      .single();
    expect(booking?.status).toBe('expired');
  });

  it('cancels a booking and records a refund within the refund window', async () => {
    const result = await beginFreshBooking();

    // Confirm the booking first.
    await admin.rpc('confirm_booking_from_payment', {
      p_booking_id: result.booking_id,
      p_payment_id: result.payment_id,
      p_stripe_event_id: `${testPrefix}-evt-cancel-${result.booking_id}`,
      p_provider_payment_id: 'pi_test',
      p_amount_gross_grosz: 10000,
    });

    const { data: beforeSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();

    const { error: cancelError } = await admin.rpc('cancel_booking', {
      p_booking_id: result.booking_id,
      p_cancelled_by: 'customer',
      p_reason: 'Integration test cancellation',
    });
    expect(cancelError).toBeNull();

    const { data: afterBooking } = await admin
      .from('bookings')
      .select('status')
      .eq('id', result.booking_id)
      .single();
    expect(afterBooking?.status).toBe('cancelled');

    const { data: afterSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(afterSession?.reserved_count).toBe(
      (beforeSession?.reserved_count ?? 0) - 1
    );

    // Repeated cancellation is harmless.
    const { error: repeatCancelError } = await admin.rpc('cancel_booking', {
      p_booking_id: result.booking_id,
      p_cancelled_by: 'customer',
      p_reason: 'Integration test cancellation',
    });
    expect(repeatCancelError).toBeNull();
    const { data: finalSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(finalSession?.reserved_count).toBe(afterSession?.reserved_count);

    const { error: refundError } = await admin.rpc('record_payment_refund', {
      p_payment_id: result.payment_id,
      p_refund_amount_grosz: 10000,
      p_reason: 'Integration test refund',
    });
    expect(refundError).toBeNull();

    const { data: payment } = await admin
      .from('payments')
      .select('refunded_amount_grosz, status')
      .eq('id', result.payment_id)
      .single();
    expect(payment?.refunded_amount_grosz).toBe(10000);
    expect(payment?.status).toBe('refunded');

    // Refund exceeding captured amount is rejected.
    const { error: overRefundError } = await admin.rpc(
      'record_payment_refund',
      {
        p_payment_id: result.payment_id,
        p_refund_amount_grosz: 1,
        p_reason: 'Over-refund attempt',
      }
    );
    expect(overRefundError).not.toBeNull();
  });

  it('creates a manual booking and reserves capacity', async () => {
    const { data: beforeSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();

    const { data, error } = await admin.rpc('begin_booking', {
      p_session_id: sessionId,
      p_quantity: 1,
      p_customer_email: `${testPrefix}-manual@example.com`,
      p_customer_first_name: 'Manual',
      p_customer_last_name: 'Customer',
      p_customer_phone: '123456789',
      p_customer_notes: '',
      p_marketing_consent: false,
      p_terms_accepted_at: new Date().toISOString(),
      p_privacy_policy_version: 'v1',
      p_participants: singleParticipant(),
      p_source: 'admin',
      p_payment_provider: 'cash',
      p_payment_status: 'paid',
      p_admin_user_id: '00000000-0000-0000-0000-000000000000',
      p_status: 'confirmed',
    });
    expect(error).toBeNull();
    const result = data as {
      booking_id: string;
      payment_id: string;
      booking_reference: string;
      confirmed_at: string | null;
    };
    bookingIds.push(result.booking_id);
    paymentIds.push(result.payment_id);
    expect(result.confirmed_at).not.toBeNull();

    const { data: afterSession } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    expect(afterSession?.reserved_count).toBe(
      (beforeSession?.reserved_count ?? 0) + 1
    );
  });

  it('moves a confirmed booking to a compatible session atomically', async () => {
    const result = await beginFreshBooking();
    await admin.rpc('confirm_booking_from_payment', {
      p_booking_id: result.booking_id,
      p_payment_id: result.payment_id,
      p_stripe_event_id: `${testPrefix}-evt-move-${result.booking_id}`,
      p_provider_payment_id: 'pi_test',
      p_amount_gross_grosz: 10000,
    });

    const { data: sourceBefore } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    const { data: destBefore } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', destinationSessionId)
      .single();

    const { error: moveError } = await admin.rpc('move_booking', {
      p_booking_id: result.booking_id,
      p_destination_session_id: destinationSessionId,
      p_actor_id: '00000000-0000-0000-0000-000000000000',
      p_actor_role: 'manager',
    });
    expect(moveError).toBeNull();

    const { data: booking } = await admin
      .from('bookings')
      .select('workshop_session_id, moved_from_session_id')
      .eq('id', result.booking_id)
      .single();
    expect(booking?.workshop_session_id).toBe(destinationSessionId);
    expect(booking?.moved_from_session_id).toBe(sessionId);

    const { data: sourceAfter } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', sessionId)
      .single();
    const { data: destAfter } = await admin
      .from('workshop_sessions')
      .select('reserved_count')
      .eq('id', destinationSessionId)
      .single();
    expect(sourceAfter?.reserved_count).toBe(
      (sourceBefore?.reserved_count ?? 0) - 1
    );
    expect(destAfter?.reserved_count).toBe(
      (destBefore?.reserved_count ?? 0) + 1
    );
  });

  it('creates, verifies and consumes a cancellation token', async () => {
    const result = await beginFreshBooking();
    tokenBookingId = result.booking_id;
    tokenPaymentId = result.payment_id;

    const { data, error } = await admin.rpc('create_cancellation_token', {
      p_booking_id: result.booking_id,
      p_expires_at: future(24),
    });
    expect(error).toBeNull();
    cancellationToken = data as string;
    expect(cancellationToken.length).toBeGreaterThan(0);

    const { data: verifyFirst, error: verifyFirstError } = await admin.rpc(
      'verify_cancellation_token',
      {
        p_booking_id: result.booking_id,
        p_token: cancellationToken,
      }
    );
    expect(verifyFirstError).toBeNull();
    expect(verifyFirst).toBe(true);

    // Token is single-use.
    const { data: verifySecond } = await admin.rpc(
      'verify_cancellation_token',
      {
        p_booking_id: result.booking_id,
        p_token: cancellationToken,
      }
    );
    expect(verifySecond).toBe(false);
  });

  it('denies public roles from enumerating private booking records', async () => {
    const privateTables = [
      'bookings',
      'customer_profiles',
      'booking_participants',
      'payments',
      'booking_events',
      'booking_cancellation_tokens',
      'stripe_events',
      'booking_emails',
    ] as const;

    for (const table of privateTables) {
      const { data, error } = await anon.from(table).select('id').limit(1);
      // RLS-enabled tables return an empty array for anon; absence of rows is not a failure.
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });

  it('allows service_role to execute required transactional functions', async () => {
    const { data, error } = await admin.rpc('expire_pending_bookings');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
