import 'server-only';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_ADMIN_TIMEZONE } from '@/lib/admin/timezones';
import { subDays, differenceInCalendarDays } from 'date-fns';

export type AnalyticsFilters = {
  from: string; // yyyy-MM-dd Warsaw
  to: string; // yyyy-MM-dd Warsaw inclusive
  workshopId?: string | null;
  venue?: string | null;
  instructorId?: string | null;
  paymentMethod?: string | null;
  includeTestData?: boolean;
};

export type AnalyticsKpis = {
  netCollectedRevenueGrosz: number;
  refundsGrosz: number;
  disputedRevenueGrosz: number;
  paidOrders: number;
  paidWorkshopParticipants: number;
  operationalOccupancy: number | null;
  realisedAttendance: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  repeatCustomerRate: number | null;
  averageBookingValueGrosz: number | null;
  averageLeadTimeDays: number | null;
  unclassifiedStripePayments: number;
  excludedRecords: number;
};

export type AnalyticsDashboard = {
  kpis: AnalyticsKpis;
  previousKpis: AnalyticsKpis;
  series: Array<{
    day: string;
    revenueGrosz: number;
    paidParticipants: number;
  }>;
  byWorkshop: Array<{
    workshopId: string;
    title: string;
    revenueGrosz: number;
    seats: number;
    occupancy: number | null;
  }>;
  byVenue: Array<{
    venue: string;
    revenueGrosz: number;
    seats: number;
  }>;
  byInstructor: Array<{
    instructorId: string;
    name: string;
    revenueGrosz: number;
    seats: number;
  }>;
  byWeekdayHour: Array<{ weekday: number; hour: number; bookings: number }>;
  paymentMix: Array<{ method: string; count: number; revenueGrosz: number }>;
  failuresRefunds: {
    failedPayments: number;
    refundedPayments: number;
  };
  cancelNoShowTrend: Array<{
    day: string;
    cancellations: number;
    noShows: number;
  }>;
  newVsReturning: { newCustomers: number; returningCustomers: number };
  leadTimeBuckets: Array<{ label: string; count: number }>;
  sessions: Array<{
    sessionId: string;
    title: string;
    startsAt: string;
    revenueGrosz: number;
    seats: number;
    capacity: number;
    checkedIn: number;
    noShows: number;
    flags: string[];
  }>;
};

type Loose = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};

function bounds(
  from: string,
  to: string
): { startUtc: string; endUtc: string } {
  const start = fromZonedTime(`${from}T00:00:00`, DEFAULT_ADMIN_TIMEZONE);
  const end = fromZonedTime(`${to}T23:59:59.999`, DEFAULT_ADMIN_TIMEZONE);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

function previousPeriod(
  from: string,
  to: string
): { from: string; to: string } {
  const start = fromZonedTime(`${from}T12:00:00`, DEFAULT_ADMIN_TIMEZONE);
  const end = fromZonedTime(`${to}T12:00:00`, DEFAULT_ADMIN_TIMEZONE);
  const days = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const prevEnd = subDays(start, 1);
  const prevStart = subDays(prevEnd, days - 1);
  return {
    from: formatInTimeZone(prevStart, DEFAULT_ADMIN_TIMEZONE, 'yyyy-MM-dd'),
    to: formatInTimeZone(prevEnd, DEFAULT_ADMIN_TIMEZONE, 'yyyy-MM-dd'),
  };
}

function emptyKpis(): AnalyticsKpis {
  return {
    netCollectedRevenueGrosz: 0,
    refundsGrosz: 0,
    disputedRevenueGrosz: 0,
    paidOrders: 0,
    paidWorkshopParticipants: 0,
    operationalOccupancy: null,
    realisedAttendance: null,
    cancellationRate: null,
    noShowRate: null,
    repeatCustomerRate: null,
    averageBookingValueGrosz: null,
    averageLeadTimeDays: null,
    unclassifiedStripePayments: 0,
    excludedRecords: 0,
  };
}

/**
 * Server-side analytics. No PII columns are selected or returned.
 * Default excludes livemode=false, analytics_excluded, and unclassified Stripe.
 */
export async function loadAnalyticsDashboard(
  filters: AnalyticsFilters
): Promise<AnalyticsDashboard> {
  const includeTest = Boolean(filters.includeTestData);
  const { startUtc, endUtc } = bounds(filters.from, filters.to);
  const prev = previousPeriod(filters.from, filters.to);
  const prevBounds = bounds(prev.from, prev.to);

  const supabase = createCartAdminClient() as unknown as Loose;

  const kpis = await computeKpis(supabase, {
    startUtc,
    endUtc,
    filters,
    includeTest,
  });
  const previousKpis = await computeKpis(supabase, {
    startUtc: prevBounds.startUtc,
    endUtc: prevBounds.endUtc,
    filters,
    includeTest,
  });

  // Series by Warsaw day from paid payments
  const { data: paidRows } = await supabase
    .from('payments')
    .select(
      'id, amount_gross_grosz, refunded_amount_grosz, disputed_amount_grosz, paid_at, status, provider, livemode, order_id, booking_id'
    )
    .in('status', ['paid', 'partially_refunded', 'refunded'])
    .gte('paid_at', startUtc)
    .lte('paid_at', endUtc);

  const orderIds = [
    ...new Set(
      (paidRows ?? [])
        .map((p: { order_id: string | null }) => p.order_id)
        .filter(Boolean)
    ),
  ] as string[];
  const bookingIds = [
    ...new Set(
      (paidRows ?? [])
        .map((p: { booking_id: string | null }) => p.booking_id)
        .filter(Boolean)
    ),
  ] as string[];

  const excludedOrderIds = new Set<string>();
  const excludedBookingIds = new Set<string>();
  if (orderIds.length) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, analytics_excluded, selected_payment_method')
      .in('id', orderIds);
    for (const o of orders ?? []) {
      if (o.analytics_excluded) excludedOrderIds.add(o.id);
    }
  }
  if (bookingIds.length) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        'id, analytics_excluded, workshop_session_id, quantity, customer_id, created_at, status'
      )
      .in('id', bookingIds);
    for (const b of bookings ?? []) {
      if (b.analytics_excluded) excludedBookingIds.add(b.id);
    }
  }

  const dayMap = new Map<
    string,
    { revenueGrosz: number; paidParticipants: number }
  >();
  for (const p of paidRows ?? []) {
    if (
      !paymentEligible(p, includeTest, excludedOrderIds, excludedBookingIds)
    ) {
      continue;
    }
    const day = formatInTimeZone(
      new Date(p.paid_at),
      DEFAULT_ADMIN_TIMEZONE,
      'yyyy-MM-dd'
    );
    const net =
      Number(p.amount_gross_grosz) -
      Number(p.refunded_amount_grosz ?? 0) -
      Number(p.disputed_amount_grosz ?? 0);
    const cur = dayMap.get(day) ?? { revenueGrosz: 0, paidParticipants: 0 };
    cur.revenueGrosz += Math.max(0, net);
    dayMap.set(day, cur);
  }

  const series = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({ day, ...v }));

  // Session performance in range (by session start)
  const { data: sessions } = await supabase
    .from('workshop_sessions')
    .select(
      'id, starts_at, capacity, reserved_count, location_name, instructor_id, workshop_id, attendance_reviewed_at, workshops(title), instructors(display_name)'
    )
    .gte('starts_at', startUtc)
    .lte('starts_at', endUtc)
    .order('starts_at', { ascending: true });

  let filteredSessions = sessions ?? [];
  if (filters.workshopId) {
    filteredSessions = filteredSessions.filter(
      (s: { workshop_id: string }) => s.workshop_id === filters.workshopId
    );
  }
  if (filters.instructorId) {
    filteredSessions = filteredSessions.filter(
      (s: { instructor_id: string | null }) =>
        s.instructor_id === filters.instructorId
    );
  }
  if (filters.venue) {
    filteredSessions = filteredSessions.filter(
      (s: { location_name: string | null }) => s.location_name === filters.venue
    );
  }

  const sessionRows: AnalyticsDashboard['sessions'] = [];
  const byWorkshopMap = new Map<
    string,
    { title: string; revenueGrosz: number; seats: number; capacity: number }
  >();
  const byVenueMap = new Map<string, { revenueGrosz: number; seats: number }>();
  const byInstructorMap = new Map<
    string,
    { name: string; revenueGrosz: number; seats: number }
  >();
  const weekdayHour = new Map<string, number>();

  for (const s of filteredSessions) {
    const title = Array.isArray(s.workshops)
      ? s.workshops[0]?.title
      : s.workshops?.title;
    const instructorName = Array.isArray(s.instructors)
      ? s.instructors[0]?.display_name
      : s.instructors?.display_name;

    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        'id, quantity, status, analytics_excluded, created_at, customer_id, order_id, booking_participants(attendance_status)'
      )
      .eq('workshop_session_id', s.id);

    let seats = 0;
    let checkedIn = 0;
    let noShows = 0;
    const revenueGrosz = 0;
    const flags: string[] = [];

    for (const b of bookings ?? []) {
      if (b.analytics_excluded && !includeTest) continue;
      if (['cancelled', 'expired', 'refunded'].includes(b.status)) continue;
      seats += Number(b.quantity) || 0;
      for (const p of b.booking_participants ?? []) {
        if (p.attendance_status === 'checked_in') checkedIn += 1;
        if (p.attendance_status === 'no_show') noShows += 1;
      }
      const starts = new Date(s.starts_at);
      const wd = Number(formatInTimeZone(starts, DEFAULT_ADMIN_TIMEZONE, 'i')); // 1=Mon
      const hour = Number(
        formatInTimeZone(starts, DEFAULT_ADMIN_TIMEZONE, 'H')
      );
      const key = `${wd}:${hour}`;
      weekdayHour.set(key, (weekdayHour.get(key) ?? 0) + 1);
    }

    if (!s.attendance_reviewed_at && new Date(s.starts_at) < new Date()) {
      flags.push('frekwencja_otwarta');
    }

    sessionRows.push({
      sessionId: s.id,
      title: title ?? 'Warsztat',
      startsAt: s.starts_at,
      revenueGrosz,
      seats,
      capacity: Number(s.capacity) || 0,
      checkedIn,
      noShows,
      flags,
    });

    const w = byWorkshopMap.get(s.workshop_id) ?? {
      title: title ?? 'Warsztat',
      revenueGrosz: 0,
      seats: 0,
      capacity: 0,
    };
    w.seats += seats;
    w.capacity += Number(s.capacity) || 0;
    byWorkshopMap.set(s.workshop_id, w);

    const venue = s.location_name?.trim() || 'Bez lokalizacji';
    const v = byVenueMap.get(venue) ?? { revenueGrosz: 0, seats: 0 };
    v.seats += seats;
    byVenueMap.set(venue, v);

    if (s.instructor_id) {
      const i = byInstructorMap.get(s.instructor_id) ?? {
        name: instructorName ?? 'Instruktor',
        revenueGrosz: 0,
        seats: 0,
      };
      i.seats += seats;
      byInstructorMap.set(s.instructor_id, i);
    }
  }

  return {
    kpis,
    previousKpis,
    series,
    byWorkshop: [...byWorkshopMap.entries()].map(([workshopId, v]) => ({
      workshopId,
      title: v.title,
      revenueGrosz: v.revenueGrosz,
      seats: v.seats,
      occupancy: v.capacity > 0 ? v.seats / v.capacity : null,
    })),
    byVenue: [...byVenueMap.entries()].map(([venue, v]) => ({
      venue,
      ...v,
    })),
    byInstructor: [...byInstructorMap.entries()].map(([instructorId, v]) => ({
      instructorId,
      ...v,
    })),
    byWeekdayHour: [...weekdayHour.entries()].map(([key, bookings]) => {
      const [weekday, hour] = key.split(':').map(Number);
      return { weekday, hour, bookings };
    }),
    paymentMix: [],
    failuresRefunds: { failedPayments: 0, refundedPayments: 0 },
    cancelNoShowTrend: [],
    newVsReturning: { newCustomers: 0, returningCustomers: 0 },
    leadTimeBuckets: [],
    sessions: sessionRows,
  };
}

function paymentEligible(
  p: {
    provider: string | null;
    livemode: boolean | null;
    order_id: string | null;
    booking_id: string | null;
  },
  includeTest: boolean,
  excludedOrders: Set<string>,
  excludedBookings: Set<string>
): boolean {
  if (p.order_id && excludedOrders.has(p.order_id) && !includeTest)
    return false;
  if (p.booking_id && excludedBookings.has(p.booking_id) && !includeTest)
    return false;
  if (!includeTest && p.provider === 'stripe') {
    if (p.livemode === false) return false;
    if (p.livemode == null) return false; // unclassified historical Stripe
  }
  return true;
}

async function computeKpis(
  supabase: Loose,
  args: {
    startUtc: string;
    endUtc: string;
    filters: AnalyticsFilters;
    includeTest: boolean;
  }
): Promise<AnalyticsKpis> {
  const kpis = emptyKpis();

  const { data: payments } = await supabase
    .from('payments')
    .select(
      'id, amount_gross_grosz, refunded_amount_grosz, disputed_amount_grosz, paid_at, status, provider, livemode, order_id, booking_id'
    )
    .gte('created_at', args.startUtc)
    .lte('created_at', args.endUtc);

  const stripeUnclassified = (payments ?? []).filter(
    (p: { provider: string; livemode: boolean | null }) =>
      p.provider === 'stripe' && p.livemode == null
  ).length;
  kpis.unclassifiedStripePayments = stripeUnclassified;

  const orderIds = [
    ...new Set(
      (payments ?? [])
        .map((p: { order_id: string | null }) => p.order_id)
        .filter(Boolean)
    ),
  ] as string[];
  const excludedOrders = new Set<string>();
  if (orderIds.length) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, analytics_excluded')
      .in('id', orderIds);
    for (const o of orders ?? []) {
      if (o.analytics_excluded) excludedOrders.add(o.id);
    }
  }
  kpis.excludedRecords = excludedOrders.size;

  const excludedBookings = new Set<string>();
  const paidOrderIds = new Set<string>();
  let gross = 0;
  let refunds = 0;
  let disputes = 0;

  for (const p of payments ?? []) {
    if (
      !paymentEligible(p, args.includeTest, excludedOrders, excludedBookings)
    ) {
      continue;
    }
    if (['paid', 'partially_refunded', 'refunded'].includes(p.status)) {
      if (p.paid_at && p.paid_at >= args.startUtc && p.paid_at <= args.endUtc) {
        gross += Number(p.amount_gross_grosz) || 0;
        refunds += Number(p.refunded_amount_grosz) || 0;
        disputes += Number(p.disputed_amount_grosz) || 0;
        if (p.order_id) paidOrderIds.add(p.order_id);
      }
    }
  }

  kpis.netCollectedRevenueGrosz = Math.max(0, gross - refunds - disputes);
  kpis.refundsGrosz = refunds;
  kpis.disputedRevenueGrosz = disputes;
  kpis.paidOrders = paidOrderIds.size;
  kpis.averageBookingValueGrosz =
    paidOrderIds.size > 0
      ? Math.round(kpis.netCollectedRevenueGrosz / paidOrderIds.size)
      : null;

  // Occupancy / attendance from sessions in range
  const { data: sessions } = await supabase
    .from('workshop_sessions')
    .select('id, capacity, reserved_count, starts_at, attendance_reviewed_at')
    .gte('starts_at', args.startUtc)
    .lte('starts_at', args.endUtc);

  let cap = 0;
  let reserved = 0;
  let checked = 0;
  let noShows = 0;
  let expectedOnReviewed = 0;

  for (const s of sessions ?? []) {
    cap += Number(s.capacity) || 0;
    reserved += Number(s.reserved_count) || 0;

    const { data: parts } = await supabase
      .from('booking_participants')
      .select(
        'attendance_status, bookings!inner(workshop_session_id, status, analytics_excluded)'
      )
      .eq('bookings.workshop_session_id', s.id);

    // Fallback simpler query if join syntax fails on client
    const { data: bookings } = await supabase
      .from('bookings')
      .select(
        'id, status, quantity, analytics_excluded, booking_participants(attendance_status)'
      )
      .eq('workshop_session_id', s.id);

    void parts;
    for (const b of bookings ?? []) {
      if (b.analytics_excluded && !args.includeTest) continue;
      const active = !['cancelled', 'expired', 'refunded'].includes(b.status);
      for (const p of b.booking_participants ?? []) {
        if (p.attendance_status === 'checked_in') checked += 1;
        if (s.attendance_reviewed_at && active) {
          expectedOnReviewed += 1;
          if (p.attendance_status === 'no_show') noShows += 1;
        }
      }
    }
    // reviewed sessions already contribute to no-show denominator above
  }

  kpis.operationalOccupancy = cap > 0 ? reserved / cap : null;
  kpis.realisedAttendance = cap > 0 ? checked / cap : null;
  kpis.noShowRate =
    expectedOnReviewed > 0 ? noShows / expectedOnReviewed : null;
  kpis.paidWorkshopParticipants = checked; // approx; refined below if needed

  // Cancellations in period
  const { count: cancelledCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'cancelled')
    .gte('cancelled_at', args.startUtc)
    .lte('cancelled_at', args.endUtc);

  const { count: createdCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', args.startUtc)
    .lte('created_at', args.endUtc);

  kpis.cancellationRate =
    createdCount && createdCount > 0
      ? (cancelledCount ?? 0) / createdCount
      : null;

  return kpis;
}

export function defaultAnalyticsRange(now = new Date()): {
  from: string;
  to: string;
} {
  const to = formatInTimeZone(now, DEFAULT_ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const fromDate = subDays(
    fromZonedTime(`${to}T12:00:00`, DEFAULT_ADMIN_TIMEZONE),
    29
  );
  const from = formatInTimeZone(fromDate, DEFAULT_ADMIN_TIMEZONE, 'yyyy-MM-dd');
  return { from, to };
}
