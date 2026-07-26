import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? '';
  const status = sp.status?.trim() ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  let query = supabase
    .from('enquiries')
    .select(
      'id, reference, status, offer_key, offer_title, customer_name, customer_email, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (status) query = query.eq('status', status);
  if (q) {
    query = query.or(
      `reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,offer_key.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Zapytania</h1>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Szukaj (ref, imię, e-mail)"
          className="min-h-10 min-w-[220px] border px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="min-h-10 border px-3 text-sm"
        >
          <option value="">Wszystkie statusy</option>
          {['new', 'contacted', 'quoted', 'won', 'lost', 'archived'].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            )
          )}
        </select>
        <button type="submit" className="min-h-10 border px-4 text-sm">
          Filtruj
        </button>
      </form>

      {error ? (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Nie udało się pobrać zapytań. Jeśli migracja 13 nie jest jeszcze
          zastosowana, zastosuj ją w Supabase, a potem odśwież.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Ref</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Klient</th>
              <th className="px-4 py-2">Oferta</th>
              <th className="px-4 py-2">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Brak zapytań.
                </td>
              </tr>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              rows.map((row: any) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/zapytania/${row.id}`}
                      className="underline"
                    >
                      {row.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2">
                    {row.customer_name}
                    <br />
                    <span className="text-xs text-gray-500">
                      {row.customer_email}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {row.offer_title || row.offer_key || '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(row.created_at).toLocaleString('pl-PL', {
                      timeZone: 'Europe/Warsaw',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
