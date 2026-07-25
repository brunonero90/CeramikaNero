import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

const STORE_DIR = path.join(process.cwd(), 'tmp', 'local-booking');

describe('local booking store', () => {
  beforeEach(() => {
    process.env.BOOKING_LOCAL_MODE = '1';
    if (existsSync(STORE_DIR)) {
      rmSync(STORE_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (existsSync(STORE_DIR)) {
      rmSync(STORE_DIR, { recursive: true, force: true });
    }
  });

  it('seeds test sessions and enforces capacity atomically', async () => {
    const { ensureLocalBookingSeed, LOCAL_TEST_SESSION_IDS } =
      await import('@/lib/booking/local-seed');
    const { beginLocalBooking, getLocalSession } =
      await import('@/lib/booking/local-store');

    await ensureLocalBookingSeed();
    const sessionId = LOCAL_TEST_SESSION_IDS.almostFull;

    const first = await beginLocalBooking({
      sessionId,
      quantity: 1,
      purchaserEmail: 'a@example.com',
      purchaserFirstName: 'Ala',
      purchaserLastName: 'Test',
      purchaserPhone: '600000001',
      marketingConsent: false,
      privacyPolicyVersion: '1.0',
      participants: [
        {
          displayName: 'Ala',
          age: null,
          participantType: 'adult',
          accessibilityNotes: null,
        },
      ],
    });
    expect(first.ok).toBe(true);

    const second = await beginLocalBooking({
      sessionId,
      quantity: 1,
      purchaserEmail: 'b@example.com',
      purchaserFirstName: 'Basia',
      purchaserLastName: 'Test',
      purchaserPhone: '600000002',
      marketingConsent: false,
      privacyPolicyVersion: '1.0',
      participants: [
        {
          displayName: 'Basia',
          age: null,
          participantType: 'adult',
          accessibilityNotes: null,
        },
      ],
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe('sold_out');
    }

    const session = await getLocalSession(sessionId);
    expect(session?.reservedCount).toBe(2);
    expect(session?.status).toBe('sold_out');
  }, 15000);

  it('is idempotent for repeated identical submissions', async () => {
    const { ensureLocalBookingSeed, LOCAL_TEST_SESSION_IDS } =
      await import('@/lib/booking/local-seed');
    const { beginLocalBooking } = await import('@/lib/booking/local-store');

    await ensureLocalBookingSeed();
    const payload = {
      sessionId: LOCAL_TEST_SESSION_IDS.dorosli,
      quantity: 1,
      purchaserEmail: 'idem@example.com',
      purchaserFirstName: 'Ida',
      purchaserLastName: 'Test',
      purchaserPhone: '600000003',
      marketingConsent: false,
      privacyPolicyVersion: '1.0',
      participants: [
        {
          displayName: 'Ida',
          age: null,
          participantType: 'adult' as const,
          accessibilityNotes: null,
        },
      ],
    };

    const a = await beginLocalBooking(payload);
    const b = await beginLocalBooking(payload);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.reused).toBe(true);
      expect(b.booking.id).toBe(a.booking.id);
      expect(b.booking.bookingReference).toBe(a.booking.bookingReference);
    }
  });

  it('rejects over-capacity participant counts', async () => {
    const { ensureLocalBookingSeed, LOCAL_TEST_SESSION_IDS } =
      await import('@/lib/booking/local-seed');
    const { beginLocalBooking } = await import('@/lib/booking/local-store');
    await ensureLocalBookingSeed();

    const result = await beginLocalBooking({
      sessionId: LOCAL_TEST_SESSION_IDS.almostFull,
      quantity: 2,
      purchaserEmail: 'over@example.com',
      purchaserFirstName: 'Ola',
      purchaserLastName: 'Test',
      purchaserPhone: '600000004',
      marketingConsent: false,
      privacyPolicyVersion: '1.0',
      participants: [
        {
          displayName: 'Ola',
          age: null,
          participantType: 'adult',
          accessibilityNotes: null,
        },
        {
          displayName: 'Olek',
          age: null,
          participantType: 'adult',
          accessibilityNotes: null,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('capacity');
  });
});
