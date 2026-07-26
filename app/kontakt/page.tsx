import type { Metadata } from 'next';
import { EnquiryForm } from '@/components/enquiry/enquiry-form';
import { PageShell, Section, SectionHeading } from '@/components/public/ui';
import { createClient } from '@/lib/supabase/server';
import { getPublicSettings } from '@/lib/database/services/site-settings';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';

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

  let contact;
  try {
    contact = contactDisplayFromSettings(await getPublicSettings());
  } catch {
    contact = contactDisplayFromSettings(null);
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
              {contact.brand}
              <br />
              {contact.addressLine}
            </p>
            <p>
              E-mail:{' '}
              <a href={`mailto:${contact.email}`} className="underline">
                {contact.email}
              </a>
            </p>
            <p>
              Telefon:{' '}
              <a href={contact.phoneHref} className="underline">
                {contact.phoneDisplay}
              </a>
            </p>
          </aside>
        </div>
      </Section>
    </PageShell>
  );
}
