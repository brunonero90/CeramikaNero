export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { WorkshopCatalog } from '@/components/workshop/workshop-catalog';
import {
  PageShell,
  Section,
  SectionHeading,
} from '@/components/public/ui';
import { services } from '@/lib/database/factory';
import { createClient } from '@/lib/supabase/server';
import { isBookingLocalMode } from '@/lib/booking/local-mode';

export const metadata: Metadata = {
  title: 'Warsztaty | Ceramika Nero',
  description:
    'Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup — Suchy Las i Ptasie Radio w Poznaniu.',
};

export default async function WorkshopsPage() {
  const workshops = await services.workshops.getAll();

  let venueByWorkshop = new Map<string, string[]>();
  if (!isBookingLocalMode()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = (await createClient()) as any;
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('workshop_sessions')
        .select('workshop_id, venue_key')
        .in('status', ['scheduled', 'sold_out'])
        .gte('starts_at', now);
      for (const row of data ?? []) {
        const key = row.venue_key as string | null;
        if (!key) continue;
        const list = venueByWorkshop.get(row.workshop_id) ?? [];
        if (!list.includes(key)) list.push(key);
        venueByWorkshop.set(row.workshop_id, list);
      }
    } catch {
      venueByWorkshop = new Map();
    }
  }

  const enriched = workshops.map((w) => ({
    ...w,
    venueKeys: venueByWorkshop.get(w.id) ?? [],
  }));

  return (
    <PageShell>
      <Section>
        <SectionHeading
          eyebrow="Katalog"
          title="Warsztaty"
          description="Filtruj według grupy wiekowej, lokalizacji i trybu rezerwacji. Oferty zapytaniowe nie trafiają do koszyka."
          align="center"
        />
        <div className="mt-10">
          <Suspense fallback={<p className="text-sm text-text-muted">Ładowanie…</p>}>
            <WorkshopCatalog workshops={enriched} />
          </Suspense>
        </div>
      </Section>
    </PageShell>
  );
}
