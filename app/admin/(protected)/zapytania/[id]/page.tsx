import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { updateEnquiryAction } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AdminEnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: enquiry } = await supabase
    .from('enquiries')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!enquiry) notFound();

  const { data: events } = await supabase
    .from('enquiry_events')
    .select('id, event_type, actor_type, metadata, created_at')
    .eq('enquiry_id', id)
    .order('created_at', { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/zapytania" className="text-sm underline">
          ← Zapytania
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{enquiry.reference}</h1>
        <p className="text-sm text-gray-600">Status: {enquiry.status}</p>
      </div>

      <section className="rounded border bg-white p-4 text-sm space-y-2">
        <p>
          <strong>{enquiry.customer_name}</strong>
          <br />
          {enquiry.customer_email}
          {enquiry.customer_phone ? (
            <>
              <br />
              {enquiry.customer_phone}
            </>
          ) : null}
        </p>
        <p>
          Oferta: {enquiry.offer_title || enquiry.offer_key || '—'}
          <br />
          Typ: {enquiry.event_type || '—'}
          <br />
          Osoby: {enquiry.participant_count ?? '—'}
          <br />
          Termin: {enquiry.preferred_date_text || '—'}
          <br />
          Kontakt: {enquiry.preferred_contact || '—'}
        </p>
        <p className="whitespace-pre-wrap border-t pt-3">{enquiry.message}</p>
      </section>

      <form
        action={updateEnquiryAction}
        className="space-y-3 rounded border bg-white p-4"
      >
        <input type="hidden" name="enquiryId" value={enquiry.id} />
        <label className="block text-sm">
          Status
          <select
            name="status"
            defaultValue={enquiry.status}
            className="mt-1 block min-h-10 w-full border px-2"
          >
            {['new', 'contacted', 'quoted', 'won', 'lost', 'archived'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              )
            )}
          </select>
        </label>
        <label className="block text-sm">
          Notatki wewnętrzne
          <textarea
            name="internalNotes"
            defaultValue={enquiry.internal_notes ?? ''}
            rows={4}
            className="mt-1 w-full border px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
        >
          Zapisz
        </button>
      </form>

      <section className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">Historia</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-gray-500">Brak zdarzeń.</p>
        ) : (
          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(events ?? []).map((ev: any) => (
              <li key={ev.id}>
                {ev.event_type} · {ev.actor_type} ·{' '}
                {new Date(ev.created_at).toLocaleString('pl-PL', {
                  timeZone: 'Europe/Warsaw',
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
