import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('linked workshop checkout UX contract', () => {
  const checkoutUi = source('components/clone/checkout-page-client.tsx');
  const checkoutServer = source('lib/cart/checkout.ts');
  const revalidation = source('lib/cart/revalidate.ts');
  const migration = source(
    'supabase/migrations/00000000000026_linked_workshops_and_reminders.sql'
  );
  const optionalMigration = source(
    'supabase/migrations/00000000000029_optional_followup_sessions.sql'
  );

  it('reuses the purchaser name for the first adult and never requires adult age', () => {
    expect(checkoutUi).toContain(
      'Użyjemy imienia i nazwiska z danych kupującego'
    );
    expect(checkoutUi).toContain("participantAudience === 'adult'");
    expect(checkoutUi).toContain("participant_type: 'adult' as const");
    expect(checkoutUi).toContain("age: ''");
    expect(checkoutUi).toContain(
      'Ważne informacje organizacyjne / potrzeby dostępności'
    );
    expect(checkoutServer).toContain("participantType !== 'child'");
    expect(migration).toContain('set age = null');
  });

  it('collects age only for child participants and supports mixed groups', () => {
    expect(checkoutUi).toContain("line.participantAudience === 'mixed'");
    expect(checkoutUi).toContain('Wiek dziecka');
    expect(checkoutUi).toContain('line.collectParticipantAge && child');
    expect(checkoutServer).toContain(
      "audience === 'mixed' && participantType === 'unspecified'"
    );
    expect(migration).toContain(
      "participant_audience in ('adult', 'child', 'mixed')"
    );
  });

  it('offers optional follow-up sessions and still supports required stages', () => {
    expect(checkoutUi).toContain('Wybierz termin szkliwienia');
    expect(checkoutUi).toContain('Nie rezerwuję teraz');
    expect(checkoutUi).toContain('offersFollowupSession');
    expect(checkoutUi).toContain("linkRole: 'followup'");
    expect(checkoutServer).toContain(
      'Wybierz obowiązkowy termin drugiego etapu'
    );
    expect(checkoutServer).toContain(".rpc('submit_cart_order_v5'");
    expect(revalidation).toContain('loadFollowupOptions');
    expect(revalidation).toContain('remaining < quantity');
    expect(migration).toContain(
      'create table if not exists public.booking_links'
    );
    expect(optionalMigration).toContain('offers_followup_session');
    expect(optionalMigration).toContain(
      'not v_primary_workshop.requires_followup_session'
    );
  });
});
