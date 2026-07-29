import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import {
  classifyRosterBooking,
  type AttendanceStatus,
  type RosterBooking,
  type SessionCockpit,
} from '@/lib/admin/session-roster';
import { formatWarsawDateTime } from '@/lib/utils/datetime';

type LooseClient = {
  // Supabase fluent builder — typed loosely until generated types catch migration 18.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  rpc: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asLoose(client: unknown): LooseClient {
  return client as LooseClient;
}

function paymentLabel(method: string | null, provider: string | null): string | null {
  if (method === 'stripe' || provider === 'stripe') return 'Online (Stripe)';
  if (method === 'bank_transfer' || provider === 'manual') return 'Przelew';
  if (provider === 'offline' || provider === 'complimentary') return 'Komplementarna / ręczna';
  return method ?? provider;
}

/**
 * Load a full operational cockpit for one workshop session.
 */
export async function loadSessionCockpit(
  sessionId: string
): Promise<SessionCockpit | null> {
  const supabase = asLoose(await createClient());

  const { data: session } = await supabase
    .from('workshop_sessions')
    .select(
      `
      id,
      starts_at,
      ends_at,
      timezone,
      capacity,
      reserved_count,
      location_name,
      location_address,
      attendance_reviewed_at,
      workshops ( title ),
      instructors ( display_name )
    `
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return null;

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      id,
      booking_reference,
      status,
      quantity,
      customer_notes,
      internal_notes,
      source,
      order_id,
      analytics_excluded,
      customer_profiles ( first_name, last_name, email, phone ),
      booking_participants (
        id, display_name, age, accessibility_notes,
        attendance_status, attendance_note, checked_in_at
      ),
      orders ( id, order_reference, selected_payment_method, payment_status, analytics_excluded )
    `
    )
    .eq('workshop_session_id', sessionId)
    .order('created_at', { ascending: true });

  const bookingIds = (bookings ?? []).map((b: { id: string }) => b.id);
  const orderIds = (bookings ?? [])
    .map((b: { order_id: string | null }) => b.order_id)
    .filter(Boolean) as string[];

  type PayRow = {
    status: string;
    provider: string | null;
    failure_message: string | null;
    created_at: string;
    order_id: string | null;
    booking_id: string | null;
  };
  const paymentsByBooking = new Map<string, PayRow[]>();
  const paymentsByOrder = new Map<string, PayRow[]>();

  if (bookingIds.length || orderIds.length) {
    const { data: payRows } = await supabase
      .from('payments')
      .select(
        'id, status, provider, failure_message, created_at, order_id, booking_id'
      )
      .or(
        [
          bookingIds.length ? `booking_id.in.(${bookingIds.join(',')})` : null,
          orderIds.length ? `order_id.in.(${orderIds.join(',')})` : null,
        ]
          .filter(Boolean)
          .join(',')
      );

    for (const p of (payRows ?? []) as PayRow[]) {
      if (p.booking_id) {
        const list = paymentsByBooking.get(p.booking_id) ?? [];
        list.push(p);
        paymentsByBooking.set(p.booking_id, list);
      }
      if (p.order_id) {
        const list = paymentsByOrder.get(p.order_id) ?? [];
        list.push(p);
        paymentsByOrder.set(p.order_id, list);
      }
    }
  }

  const ready: RosterBooking[] = [];
  const attention: RosterBooking[] = [];
  const removed: RosterBooking[] = [];

  let confirmedPaidSeats = 0;
  let checkedInCount = 0;
  let absentCount = 0;

  for (const raw of bookings ?? []) {
    const profile = Array.isArray(raw.customer_profiles)
      ? raw.customer_profiles[0]
      : raw.customer_profiles;
    const order = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders;
    const payments = [
      ...(paymentsByBooking.get(raw.id) ?? []),
      ...(order?.id ? (paymentsByOrder.get(order.id) ?? []) : []),
    ];
    // Prefer order-level payment when linked; else latest booking payment.
    let paymentStatus: string | null = order?.payment_status ?? null;
    let paymentProvider: string | null = null;
    let paymentReconciling = false;
    if (payments.length) {
      const latest = [...payments].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1
      )[0];
      paymentStatus = latest.status ?? paymentStatus;
      paymentProvider = latest.provider;
      paymentReconciling =
        latest.failure_message === 'stripe_checkout_reconciling';
    }

    const participants = (
      (raw.booking_participants ?? []) as Array<{
        id: string;
        display_name: string | null;
        age: number | null;
        accessibility_notes: string | null;
        attendance_status: string | null;
        attendance_note: string | null;
        checked_in_at: string | null;
      }>
    ).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      age: p.age,
      accessibilityNotes: p.accessibility_notes,
      attendanceStatus: (p.attendance_status ??
        'expected') as AttendanceStatus,
      attendanceNote: p.attendance_note,
      checkedInAt: p.checked_in_at,
    }));

    const isComplimentary =
      paymentProvider === 'offline' ||
      paymentProvider === 'complimentary' ||
      (raw.status === 'confirmed' &&
        (paymentStatus === 'paid' || paymentStatus == null) &&
        paymentProvider == null &&
        Number(raw.quantity) > 0 &&
        order?.selected_payment_method == null &&
        payments.length === 0);

    // Admin complimentary often has confirmed + no stripe payment row.
    const complimentaryGuess =
      raw.status === 'confirmed' &&
      payments.every((p) => p.provider !== 'stripe') &&
      (paymentStatus === 'paid' ||
        paymentStatus == null ||
        payments.some((p) => p.provider === 'manual' || p.provider === 'offline'));

    const { bucket, attentionReasons } = classifyRosterBooking({
      bookingStatus: raw.status,
      paymentStatus,
      paymentReconciling,
      paymentMethod: order?.selected_payment_method ?? null,
      isComplimentary: Boolean(isComplimentary || complimentaryGuess),
      participants,
      purchaserPhone: profile?.phone ?? null,
      customerNotes: raw.customer_notes,
      internalNotes: raw.internal_notes,
    });

    if (
      bucket !== 'removed' &&
      raw.status === 'confirmed' &&
      (paymentStatus === 'paid' ||
        paymentStatus === 'partially_refunded' ||
        isComplimentary ||
        complimentaryGuess)
    ) {
      confirmedPaidSeats += Number(raw.quantity) || participants.length || 0;
    }

    for (const p of participants) {
      if (p.attendanceStatus === 'checked_in') checkedInCount += 1;
      if (
        p.attendanceStatus === 'no_show' ||
        p.attendanceStatus === 'excused'
      ) {
        absentCount += 1;
      }
    }

    const booking: RosterBooking = {
      bookingId: raw.id,
      bookingReference: raw.booking_reference,
      orderId: order?.id ?? raw.order_id ?? null,
      orderReference: order?.order_reference ?? null,
      bookingStatus: raw.status,
      paymentStatus,
      paymentMethod: paymentLabel(
        order?.selected_payment_method ?? null,
        paymentProvider
      ),
      paymentProvider,
      paymentReconciling,
      quantity: Number(raw.quantity) || 0,
      purchaserName: profile
        ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
        : '—',
      purchaserEmail: profile?.email ?? null,
      purchaserPhone: profile?.phone ?? null,
      customerNotes: raw.customer_notes,
      internalNotes: raw.internal_notes,
      source: raw.source,
      analyticsExcluded: Boolean(
        raw.analytics_excluded || order?.analytics_excluded
      ),
      missingParticipantName: participants.some((p) => !p.displayName?.trim()),
      missingPurchaserPhone: !profile?.phone?.trim(),
      bucket,
      attentionReasons,
      participants,
    };

    if (bucket === 'ready') ready.push(booking);
    else if (bucket === 'removed') removed.push(booking);
    else attention.push(booking);
  }

  const workshopTitle = Array.isArray(session.workshops)
    ? session.workshops[0]?.title
    : session.workshops?.title;
  const instructorName = Array.isArray(session.instructors)
    ? session.instructors[0]?.display_name
    : session.instructors?.display_name;

  const capacity = Number(session.capacity) || 0;
  const reserved = Number(session.reserved_count) || 0;
  const warnings: string[] = [];
  if (attention.length > 0) {
    warnings.push(`${attention.length} rezerwacji wymaga uwagi`);
  }
  if (reserved > capacity) {
    warnings.push('Zarezerwowano więcej miejsc niż wynosi pojemność');
  }
  if (
    session.starts_at &&
    new Date(session.starts_at) < new Date() &&
    !session.attendance_reviewed_at
  ) {
    warnings.push('Frekwencja nie została jeszcze zamknięta');
  }

  return {
    sessionId: session.id,
    workshopTitle: workshopTitle ?? 'Warsztat',
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    timezone: session.timezone ?? 'Europe/Warsaw',
    locationName: session.location_name,
    locationAddress: session.location_address,
    instructorName: instructorName ?? null,
    capacity,
    reservedCount: reserved,
    confirmedPaidSeats,
    placesRemaining: Math.max(0, capacity - reserved),
    checkedInCount,
    absentCount,
    attendanceReviewedAt: session.attendance_reviewed_at ?? null,
    warnings,
    ready,
    attention,
    removed,
  };
}

export async function loadTodaysSessions(
  now: Date = new Date()
): Promise<SessionCockpit[]> {
  const { warsawDayBounds } = await import('@/lib/admin/session-roster');
  const { startUtc, endUtc } = warsawDayBounds(now);
  const supabase = asLoose(await createClient());

  const { data: sessions } = await supabase
    .from('workshop_sessions')
    .select('id')
    .gte('starts_at', startUtc)
    .lte('starts_at', endUtc)
    .in('status', ['scheduled', 'sold_out', 'cancelled'])
    .order('starts_at', { ascending: true });

  const cockpits: SessionCockpit[] = [];
  for (const s of sessions ?? []) {
    const c = await loadSessionCockpit(s.id);
    if (c) cockpits.push(c);
  }
  return cockpits;
}

export { formatWarsawDateTime };

/** Service-role RPC for attendance (bypasses RLS after role check in action). */
export async function rpcSetParticipantAttendance(input: {
  participantId: string;
  status: AttendanceStatus;
  actorUserId: string;
  note?: string | null;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const admin = asLoose(createCartAdminClient());
  const { data, error } = await admin.rpc('set_participant_attendance', {
    p_participant_id: input.participantId,
    p_status: input.status,
    p_actor_user_id: input.actorUserId,
    p_note: input.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    status: String((data as { status?: string })?.status ?? 'updated'),
  };
}

export async function rpcMarkRemainingNoShows(input: {
  sessionId: string;
  actorUserId: string;
}): Promise<{ ok: true; marked: number } | { ok: false; error: string }> {
  const admin = asLoose(createCartAdminClient());
  const { data, error } = await admin.rpc('mark_remaining_no_shows', {
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    marked: Number((data as { marked?: number })?.marked ?? 0),
  };
}

export async function rpcCompleteAttendanceReview(input: {
  sessionId: string;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = asLoose(createCartAdminClient());
  const { error } = await admin.rpc('complete_session_attendance_review', {
    p_session_id: input.sessionId,
    p_actor_user_id: input.actorUserId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rpcSetAnalyticsExcluded(input: {
  entityType: 'order' | 'booking';
  entityId: string;
  excluded: boolean;
  reason: string | null;
  actorUserId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = asLoose(createCartAdminClient());
  const { error } = await admin.rpc('set_analytics_excluded', {
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_excluded: input.excluded,
    p_reason: input.reason,
    p_actor_user_id: input.actorUserId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
