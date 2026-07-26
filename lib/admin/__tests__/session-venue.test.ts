import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionInputSchema } from '@/lib/admin/schemas';

describe('session venue_key admin support', () => {
  it('accepts suchy-las and ptasie-radio venue keys', () => {
    const base = {
      workshopId: '11111111-1111-4111-8111-111111111111',
      startsAt: '2026-08-01T08:00:00.000Z',
      endsAt: '2026-08-01T10:00:00.000Z',
      timezone: 'Europe/Warsaw',
      capacity: 8,
      priceGrossPln: 180,
      status: 'draft' as const,
    };
    expect(
      sessionInputSchema.parse({ ...base, venueKey: 'ptasie-radio' }).venueKey
    ).toBe('ptasie-radio');
    expect(
      sessionInputSchema.parse({ ...base, venueKey: 'suchy-las' }).venueKey
    ).toBe('suchy-las');
  });

  it('session form and actions persist venue_key', () => {
    const form = readFileSync(
      join(process.cwd(), 'app/admin/(protected)/terminy/session-form.tsx'),
      'utf8'
    );
    const actions = readFileSync(
      join(process.cwd(), 'app/admin/(protected)/terminy/actions.ts'),
      'utf8'
    );
    expect(form).toContain('name="venueKey"');
    expect(form).toContain('ptasie-radio');
    expect(actions).toContain('venue_key');
    expect(actions).toContain('aktywnymi rezerwacjami');
  });
});
