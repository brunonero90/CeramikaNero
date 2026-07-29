import { describe, expect, it } from 'vitest';
import {
  classifyRosterBooking,
  warsawDayBounds,
} from '@/lib/admin/session-roster';
import { csvEscapeCell, toCsv } from '@/lib/admin/csv';

describe('warsawDayBounds', () => {
  it('uses Europe/Warsaw day boundaries', () => {
    // 2026-07-28 22:30 UTC = 2026-07-29 00:30 in Warsaw (CEST)
    const bounds = warsawDayBounds(new Date('2026-07-28T22:30:00.000Z'));
    expect(bounds.day).toBe('2026-07-29');
    expect(new Date(bounds.startUtc) < new Date(bounds.endUtc)).toBe(true);
    expect(bounds.startUtc.endsWith('Z')).toBe(true);
  });
});

describe('classifyRosterBooking', () => {
  it('puts confirmed paid bookings in ready', () => {
    const result = classifyRosterBooking({
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      paymentReconciling: false,
      paymentMethod: 'stripe',
      isComplimentary: false,
      participants: [{ displayName: 'Anna', accessibilityNotes: null }],
      purchaserPhone: '+48111111111',
      customerNotes: null,
      internalNotes: null,
    });
    expect(result.bucket).toBe('ready');
  });

  it('flags awaiting payment and missing fields as attention', () => {
    const result = classifyRosterBooking({
      bookingStatus: 'awaiting_payment',
      paymentStatus: 'pending',
      paymentReconciling: false,
      paymentMethod: 'stripe',
      isComplimentary: false,
      participants: [{ displayName: null, accessibilityNotes: 'wózek' }],
      purchaserPhone: null,
      customerNotes: 'proszę o kontakt',
      internalNotes: null,
    });
    expect(result.bucket).toBe('attention');
    expect(result.attentionReasons).toEqual(
      expect.arrayContaining([
        'awaiting_payment',
        'missing_participant_name',
        'missing_purchaser_phone',
        'customer_notes',
        'accessibility_notes',
      ])
    );
  });

  it('does not count expired/refunded as expected attendance', () => {
    expect(
      classifyRosterBooking({
        bookingStatus: 'expired',
        paymentStatus: 'failed',
        paymentReconciling: false,
        paymentMethod: 'stripe',
        isComplimentary: false,
        participants: [{ displayName: 'X', accessibilityNotes: null }],
        purchaserPhone: '123',
        customerNotes: null,
        internalNotes: null,
      }).bucket
    ).toBe('removed');
    expect(
      classifyRosterBooking({
        bookingStatus: 'refunded',
        paymentStatus: 'refunded',
        paymentReconciling: false,
        paymentMethod: 'stripe',
        isComplimentary: false,
        participants: [{ displayName: 'X', accessibilityNotes: null }],
        purchaserPhone: '123',
        customerNotes: null,
        internalNotes: null,
      }).bucket
    ).toBe('removed');
  });
});

describe('csv formula injection', () => {
  it('neutralizes formula prefixes and emits UTF-8 BOM', () => {
    expect(csvEscapeCell('=cmd')).toBe("'=cmd");
    expect(csvEscapeCell('+1')).toBe("'+1");
    expect(csvEscapeCell('-1')).toBe("'-1");
    expect(csvEscapeCell('@x')).toBe("'@x");
    const csv = toCsv(['a'], [['ok']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });
});
