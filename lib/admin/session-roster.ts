import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { DEFAULT_ADMIN_TIMEZONE } from '@/lib/admin/timezones';

export type AttendanceStatus =
  | 'expected'
  | 'checked_in'
  | 'no_show'
  | 'excused';

export type RosterBucket = 'ready' | 'attention' | 'removed';

export type RosterParticipant = {
  id: string;
  displayName: string | null;
  age: number | null;
  accessibilityNotes: string | null;
  attendanceStatus: AttendanceStatus;
  attendanceNote: string | null;
  checkedInAt: string | null;
};

export type RosterBooking = {
  bookingId: string;
  bookingReference: string;
  orderId: string | null;
  orderReference: string | null;
  bookingStatus: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentProvider: string | null;
  paymentReconciling: boolean;
  quantity: number;
  purchaserName: string;
  purchaserEmail: string | null;
  purchaserPhone: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  source: string | null;
  analyticsExcluded: boolean;
  missingParticipantName: boolean;
  missingPurchaserPhone: boolean;
  bucket: RosterBucket;
  attentionReasons: string[];
  participants: RosterParticipant[];
};

export type SessionCockpit = {
  sessionId: string;
  workshopTitle: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  locationName: string | null;
  locationAddress: string | null;
  instructorName: string | null;
  capacity: number;
  reservedCount: number;
  confirmedPaidSeats: number;
  placesRemaining: number;
  checkedInCount: number;
  absentCount: number;
  attendanceReviewedAt: string | null;
  warnings: string[];
  ready: RosterBooking[];
  attention: RosterBooking[];
  removed: RosterBooking[];
};

const TERMINAL_BOOKING = new Set([
  'cancelled',
  'expired',
  'refunded',
]);

const PAID_PAYMENT = new Set(['paid', 'partially_refunded']);

export function warsawDayBounds(isoDateOrNow: Date | string = new Date()): {
  day: string;
  startUtc: string;
  endUtc: string;
} {
  const ref =
    typeof isoDateOrNow === 'string' ? new Date(isoDateOrNow) : isoDateOrNow;
  const day = formatInTimeZone(ref, DEFAULT_ADMIN_TIMEZONE, 'yyyy-MM-dd');
  const start = fromZonedTime(`${day}T00:00:00`, DEFAULT_ADMIN_TIMEZONE);
  const end = fromZonedTime(`${day}T23:59:59.999`, DEFAULT_ADMIN_TIMEZONE);
  return {
    day,
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
  };
}

export function classifyRosterBooking(input: {
  bookingStatus: string;
  paymentStatus: string | null;
  paymentReconciling: boolean;
  paymentMethod: string | null;
  isComplimentary: boolean;
  participants: Array<{ displayName: string | null; accessibilityNotes: string | null }>;
  purchaserPhone: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
}): { bucket: RosterBucket; attentionReasons: string[] } {
  if (TERMINAL_BOOKING.has(input.bookingStatus)) {
    return { bucket: 'removed', attentionReasons: [] };
  }

  const reasons: string[] = [];
  const awaiting =
    input.bookingStatus === 'awaiting_payment' ||
    input.bookingStatus === 'pending' ||
    (input.paymentStatus != null &&
      !PAID_PAYMENT.has(input.paymentStatus) &&
      input.paymentStatus !== 'refunded' &&
      !input.isComplimentary);

  if (awaiting) reasons.push('awaiting_payment');
  if (input.paymentReconciling) reasons.push('payment_reconciling');
  if (input.participants.some((p) => !p.displayName?.trim())) {
    reasons.push('missing_participant_name');
  }
  if (!input.purchaserPhone?.trim()) reasons.push('missing_purchaser_phone');
  if (input.customerNotes?.trim()) reasons.push('customer_notes');
  if (input.internalNotes?.trim()) reasons.push('internal_notes');
  if (input.participants.some((p) => p.accessibilityNotes?.trim())) {
    reasons.push('accessibility_notes');
  }

  const ready =
    (input.bookingStatus === 'confirmed' &&
      (input.isComplimentary ||
        (input.paymentStatus != null && PAID_PAYMENT.has(input.paymentStatus)))) ||
    (input.bookingStatus === 'confirmed' && input.isComplimentary);

  // Confirmed + paid / complimentary without other flags → ready
  if (
    input.bookingStatus === 'confirmed' &&
    (input.isComplimentary ||
      (input.paymentStatus != null && PAID_PAYMENT.has(input.paymentStatus))) &&
    !input.paymentReconciling &&
    reasons.every((r) =>
      ['customer_notes', 'internal_notes', 'accessibility_notes'].includes(r)
    )
  ) {
    // Notes still put into attention for operational visibility
    if (
      reasons.includes('customer_notes') ||
      reasons.includes('internal_notes') ||
      reasons.includes('accessibility_notes') ||
      reasons.includes('missing_participant_name') ||
      reasons.includes('missing_purchaser_phone')
    ) {
      return { bucket: 'attention', attentionReasons: reasons };
    }
    return { bucket: 'ready', attentionReasons: [] };
  }

  if (reasons.length > 0 || !ready) {
    return {
      bucket: 'attention',
      attentionReasons: reasons.length ? reasons : ['needs_review'],
    };
  }

  return { bucket: 'ready', attentionReasons: [] };
}

export function humanAttentionReason(code: string): string {
  switch (code) {
    case 'awaiting_payment':
      return 'Oczekuje na płatność';
    case 'payment_reconciling':
      return 'Płatność w trakcie potwierdzenia';
    case 'missing_participant_name':
      return 'Brak imienia uczestnika';
    case 'missing_purchaser_phone':
      return 'Brak telefonu kupującego';
    case 'customer_notes':
      return 'Notatka klienta';
    case 'internal_notes':
      return 'Notatka wewnętrzna';
    case 'accessibility_notes':
      return 'Informacje organizacyjne / dostępność';
    default:
      return 'Wymaga przeglądu';
  }
}

export function humanAttendance(status: AttendanceStatus): string {
  switch (status) {
    case 'checked_in':
      return 'Obecny';
    case 'no_show':
      return 'Nieobecny';
    case 'excused':
      return 'Usprawiedliwiony';
    default:
      return 'Oczekiwany';
  }
}

export function humanPaymentStatus(status: string | null): string {
  switch (status) {
    case 'paid':
      return 'Opłacone';
    case 'pending':
    case 'created':
      return 'Oczekuje';
    case 'failed':
      return 'Nieudana';
    case 'refunded':
      return 'Zwrócone';
    case 'partially_refunded':
      return 'Częściowo zwrócone';
    case 'cancelled':
      return 'Anulowana';
    case null:
      return 'Brak płatności';
    default:
      return status;
  }
}
