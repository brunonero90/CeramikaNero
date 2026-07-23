import { describe, it, expect } from 'vitest';
import {
  isBookingActive,
  canCancelBooking,
  canRefundPayment,
  canMoveBooking,
  bookingStatusFromRefund,
} from '../state';

describe('booking state helpers', () => {
  it('considers pending, awaiting_payment and confirmed as active', () => {
    expect(isBookingActive('pending')).toBe(true);
    expect(isBookingActive('awaiting_payment')).toBe(true);
    expect(isBookingActive('confirmed')).toBe(true);
    expect(isBookingActive('cancelled')).toBe(false);
    expect(isBookingActive('expired')).toBe(false);
    expect(isBookingActive('refunded')).toBe(false);
  });

  it('allows cancellation only for active states', () => {
    expect(canCancelBooking('pending')).toBe(true);
    expect(canCancelBooking('awaiting_payment')).toBe(true);
    expect(canCancelBooking('confirmed')).toBe(true);
    expect(canCancelBooking('cancelled')).toBe(false);
    expect(canCancelBooking('expired')).toBe(false);
  });

  it('allows refund only for paid or partially refunded payments', () => {
    expect(canRefundPayment('paid')).toBe(true);
    expect(canRefundPayment('partially_refunded')).toBe(true);
    expect(canRefundPayment('created')).toBe(false);
    expect(canRefundPayment('pending')).toBe(false);
    expect(canRefundPayment('failed')).toBe(false);
  });

  it('allows move only for confirmed or awaiting_payment bookings', () => {
    expect(canMoveBooking('confirmed')).toBe(true);
    expect(canMoveBooking('awaiting_payment')).toBe(true);
    expect(canMoveBooking('pending')).toBe(false);
    expect(canMoveBooking('cancelled')).toBe(false);
  });

  it('derives refund status from amounts', () => {
    expect(bookingStatusFromRefund(10000, 10000)).toBe('refunded');
    expect(bookingStatusFromRefund(5000, 10000)).toBe('partially_refunded');
  });
});
