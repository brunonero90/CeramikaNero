import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Mirror the workshop checkout constraints without importing server-only module.
const participantSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  age: z.union([z.number().int(), z.string()]).optional().nullable(),
  accessibility_notes: z.string().max(500).optional().nullable(),
});

const checkoutPhone = z.string().trim().min(5).max(40);

describe('workshop checkout collection', () => {
  it('requires participant display name and purchaser phone', () => {
    expect(participantSchema.safeParse({ display_name: '' }).success).toBe(
      false
    );
    expect(
      participantSchema.safeParse({ display_name: 'Anna' }).success
    ).toBe(true);
    expect(checkoutPhone.safeParse('').success).toBe(false);
    expect(checkoutPhone.safeParse('532279101').success).toBe(true);
  });

  it('accepts accessibility notes separately from customer notes', () => {
    const parsed = participantSchema.parse({
      display_name: 'Ola',
      accessibility_notes: 'Potrzebuję miejsca bliżej wejścia',
    });
    expect(parsed.accessibility_notes).toContain('wejścia');
  });
});
