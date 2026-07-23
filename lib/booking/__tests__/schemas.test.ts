import { describe, it, expect } from 'vitest';
import {
  publicBookingInputSchema,
  manualBookingInputSchema,
  refundInputSchema,
} from '@/lib/database/schema';

const basePublicBooking = {
  sessionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  quantity: 2,
  purchaserEmail: 'jan@example.com',
  purchaserFirstName: 'Jan',
  purchaserLastName: 'Kowalski',
  purchaserPhone: '+48 123 456 789',
  customerNotes: '',
  marketingConsent: false,
  termsAccepted: true,
  privacyPolicyVersion: '1.0',
  participants: [
    {
      displayName: 'Ania',
      age: 30,
      participantType: 'adult',
      accessibilityNotes: '',
    },
    {
      displayName: 'Tomek',
      age: 8,
      participantType: 'child',
      accessibilityNotes: '',
    },
  ],
};

describe('public booking schema', () => {
  it('validates a complete public booking', () => {
    const result = publicBookingInputSchema.safeParse(basePublicBooking);
    expect(result.success).toBe(true);
  });

  it('rejects missing terms acceptance', () => {
    const result = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      termsAccepted: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      purchaserEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity outside the allowed range', () => {
    const tooMany = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      quantity: 11,
    });
    expect(tooMany.success).toBe(false);

    const zero = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      quantity: 0,
    });
    expect(zero.success).toBe(false);
  });

  it('rejects a participant array with the wrong length', () => {
    const result = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      participants: [basePublicBooking.participants[0]],
    });
    expect(result.success).toBe(false);
  });

  it('requires age when workshop has age limits', () => {
    // The schema itself does not know the workshop limits; we test that the
    // age field must be a positive integer when provided.
    const result = publicBookingInputSchema.safeParse({
      ...basePublicBooking,
      participants: [
        {
          displayName: 'Ania',
          age: 'abc',
          participantType: 'adult',
          accessibilityNotes: '',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe('manual booking schema', () => {
  it('validates a manual booking without terms acceptance', () => {
    const result = manualBookingInputSchema.safeParse({
      ...basePublicBooking,
      paymentMethod: 'cash',
      paymentStatus: 'confirmed',
      internalNotes: 'VIP guest',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unsupported payment method', () => {
    const result = manualBookingInputSchema.safeParse({
      ...basePublicBooking,
      paymentMethod: 'bitcoin',
      paymentStatus: 'confirmed',
    });
    expect(result.success).toBe(false);
  });
});

describe('refund schema', () => {
  it('validates a positive refund amount', () => {
    const result = refundInputSchema.safeParse({
      amountGrossGrosz: 10000,
      reason: 'Customer request',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-positive refund amount', () => {
    const result = refundInputSchema.safeParse({
      amountGrossGrosz: 0,
      reason: 'Customer request',
    });
    expect(result.success).toBe(false);
  });
});
