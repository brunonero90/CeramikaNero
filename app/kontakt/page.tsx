import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/enquiry/enquiry-form';
import { PageShell, Section, SectionHeading } from '@/components/public/ui';
import { siteContact } from '@/lib/fixtures/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kontakt | Ceramika Nero',
  description:
    'Napisz do Pracowni Ceramiki Nero — zapytania o warsztaty, wydarzenia prywatne i Glina Box.',
};

export default async function KontaktPage({
  searchParams,
}: {
  searchParams: Promise<{ oferta?: string }>;
}) {
  const sp = await searchParams;
  const offerKey = sp.oferta?.trim() || null;
  let offerTitle: string | null = null;

  if (offerKey) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('workshops')
      .select('title')
      .eq('slug', offerKey)
      .eq('status', 'published')
      .maybeSingle();
    offerTitle = data?.title ?? offerKey;
  }

  return (
    <PageShell>
      <Section>
        <SectionHeading
          eyebrow="Kontakt"
          title="Napisz do nas"
          description="Formularz trafia do pracowni. Na zapytania odpowiadamy zwykle w ciągu 1–2 dni roboczych."
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <EnquiryForm offerKey={offerKey} offerTitle={offerTitle} />
          <aside className="space-y-4 text-sm text-text-muted">
            <h2 className="font-heading text-xl font-semibold text-text-primary">
              Dane pracowni
            </h2>
            <p>
              {siteContact.brand}
              <br />
              {siteContact.addressLine}
              <br />
              {siteContact.cityLine}
            </p>
            <p>
              E-mail:{' '}
              <a href={`mailto:${siteContact.email}`} className="underline">
                {siteContact.email}
              </a>
            </p>
            <p>
              Telefon:{' '}
              <a href={siteContact.phoneHref} className="underline">
                {siteContact.phoneDisplay}
              </a>
            </p>
          </aside>
        </div>
      </Section>
    </PageShell>
  );
}
