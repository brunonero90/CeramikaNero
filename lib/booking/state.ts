import {
  bookingStatusSchema,
  paymentStatusSchema,
} from '@/lib/database/schema';

const BookingStatus = bookingStatusSchema.enum;
const PaymentStatus = paymentStatusSchema.enum;

export function isBookingActive(status: string): boolean {
  return (
    status === BookingStatus.pending ||
    status === BookingStatus.awaiting_payment ||
    status === BookingStatus.confirmed
  );
}

export function canCancelBooking(status: string): boolean {
  return (
    status === BookingStatus.pending ||
    status === BookingStatus.awaiting_payment ||
    status === BookingStatus.confirmed
  );
}

export function canRefundPayment(status: string): boolean {
  return (
    status === PaymentStatus.paid || status === PaymentStatus.partially_refunded
  );
}

export function canMoveBooking(status: string): boolean {
  return (
    status === BookingStatus.confirmed ||
    status === BookingStatus.awaiting_payment
  );
}

export function isBookingTerminal(status: string): boolean {
  return (
    status === BookingStatus.cancelled ||
    status === BookingStatus.expired ||
    status === BookingStatus.refunded ||
    status === BookingStatus.partially_refunded
  );
}

export function bookingStatusFromRefund(
  refundedGrosz: number,
  totalGrosz: number
): 'refunded' | 'partially_refunded' {
  return refundedGrosz >= totalGrosz ? 'refunded' : 'partially_refunded';
}
