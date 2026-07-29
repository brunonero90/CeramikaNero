import Link from 'next/link';
import { requireAnyRole } from '@/lib/admin/auth';
import {
  defaultAnalyticsRange,
  loadAnalyticsDashboard,
} from '@/lib/admin/analytics';
import { formatGroszAsPln } from '@/lib/utils/money';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Analityka | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function delta(current: number, previous: number): string {
  const d = current - previous;
  const sign = d > 0 ? '+' : '';
  return `${sign}${formatGroszAsPln(d)}`;
}

function BarChart({
  items,
  valueKey,
  labelKey,
}: {
  items: Array<Record<string, string | number | null>>;
  valueKey: string;
  labelKey: string;
}) {
  const max = Math.max(
    1,
    ...items.map((i) => Number(i[valueKey]) || 0)
  );
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">Brak danych w okresie.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.slice(0, 12).map((item) => {
        const value = Number(item[valueKey]) || 0;
        const width = Math.round((value / max) * 100);
        return (
          <li key={String(item[labelKey])}>
            <div className="flex justify-between text-xs text-gray-600">
              <span className="truncate pr-2">{String(item[labelKey])}</span>
              <span>{valueKey.includes('Grosz') || valueKey.includes('revenue') ? formatGroszAsPln(value) : value}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-gray-100">
              <div
                className="h-2 rounded bg-stone-700"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAnyRole(['manager']);
  const params = await searchParams;
  const defaults = defaultAnalyticsRange();
  const from =
    typeof params.from === 'string' && params.from
      ? params.from
      : defaults.from;
  const to =
    typeof params.to === 'string' && params.to ? params.to : defaults.to;
  const includeTestData = params.includeTest === '1';
  const workshopId =
    typeof params.workshop === 'string' ? params.workshop : null;
  const instructorId =
    typeof params.instructor === 'string' ? params.instructor : null;
  const venue = typeof params.venue === 'string' ? params.venue : null;

  const supabase = await createClient();
  const [{ data: workshops }, { data: instructors }, dashboard] =
    await Promise.all([
      supabase.from('workshops').select('id, title').order('title'),
      supabase
        .from('instructors')
        .select('id, display_name')
        .eq('is_active', true)
        .order('display_name'),
      loadAnalyticsDashboard({
        from,
        to,
        workshopId,
        instructorId,
        venue,
        includeTestData,
      }),
    ]);

  const { kpis, previousKpis } = dashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analityka</h1>
        <p className="mt-1 text-sm text-gray-600">
          Metryki operacyjne i przychody zebrane (nie zysk). Domyślnie bez
          testów Stripe i rekordów wykluczonych.
        </p>
      </div>

      <form
        method="get"
        className="grid gap-3 rounded-md border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="text-sm">
          Od
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
        <label className="text-sm">
          Do
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
        <label className="text-sm">
          Warsztat
          <select
            name="workshop"
            defaultValue={workshopId ?? ''}
            className="mt-1 w-full rounded border px-2 py-2"
          >
            <option value="">Wszystkie</option>
            {(workshops ?? []).map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Instruktor
          <select
            name="instructor"
            defaultValue={instructorId ?? ''}
            className="mt-1 w-full rounded border px-2 py-2"
          >
            <option value="">Wszyscy</option>
            {(instructors ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          Lokalizacja (dokładna nazwa)
          <input
            name="venue"
            defaultValue={venue ?? ''}
            className="mt-1 w-full rounded border px-2 py-2"
            placeholder="np. Suchy Las"
          />
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            name="includeTest"
            value="1"
            defaultChecked={includeTestData}
          />
          Uwzględnij dane testowe / wykluczone
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Filtruj
          </button>
        </div>
      </form>

      {kpis.unclassifiedStripePayments > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {kpis.unclassifiedStripePayments} płatności Stripe bez ustalonego
          trybu (live/test) — wykluczone z domyślnych KPI. Uzupełnij livemode
          z Dashboardu lub oznacz zamówienia jako wykluczone.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: 'Przychód netto zebrany',
            value: formatGroszAsPln(kpis.netCollectedRevenueGrosz),
            prev: delta(
              kpis.netCollectedRevenueGrosz,
              previousKpis.netCollectedRevenueGrosz
            ),
          },
          {
            label: 'Zwroty',
            value: formatGroszAsPln(kpis.refundsGrosz),
            prev: delta(kpis.refundsGrosz, previousKpis.refundsGrosz),
          },
          {
            label: 'Opłacone zamówienia',
            value: String(kpis.paidOrders),
            prev: `${kpis.paidOrders - previousKpis.paidOrders >= 0 ? '+' : ''}${kpis.paidOrders - previousKpis.paidOrders}`,
          },
          {
            label: 'Zajętość operacyjna',
            value: pct(kpis.operationalOccupancy),
            prev: 'vs poprzedni okres',
          },
          {
            label: 'Frekwencja zrealizowana',
            value: pct(kpis.realisedAttendance),
            prev: 'vs pojemność',
          },
          {
            label: 'Anulacje',
            value: pct(kpis.cancellationRate),
            prev: 'udział w utworzonych',
          },
          {
            label: 'No-show',
            value: pct(kpis.noShowRate),
            prev: 'po zamkniętej frekwencji',
          },
          {
            label: 'Śr. wartość zamówienia',
            value:
              kpis.averageBookingValueGrosz != null
                ? formatGroszAsPln(kpis.averageBookingValueGrosz)
                : '—',
            prev: 'netto / opłacone',
          },
          {
            label: 'Wykluczone rekordy (okres)',
            value: String(kpis.excludedRecords),
            prev: 'analytics_excluded',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-md border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.prev}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">Przychód w czasie</h2>
          <div className="mt-3">
            <BarChart
              items={dashboard.series.map((s) => ({
                label: s.day,
                revenueGrosz: s.revenueGrosz,
              }))}
              labelKey="label"
              valueKey="revenueGrosz"
            />
          </div>
          <table className="mt-4 w-full text-left text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-1">Dzień</th>
                <th className="py-1">Przychód</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.series.map((s) => (
                <tr key={s.day} className="border-b last:border-0">
                  <td className="py-1">{s.day}</td>
                  <td className="py-1">{formatGroszAsPln(s.revenueGrosz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">Zajętość wg warsztatu</h2>
          <div className="mt-3">
            <BarChart
              items={dashboard.byWorkshop.map((w) => ({
                label: w.title,
                seats: w.seats,
              }))}
              labelKey="label"
              valueKey="seats"
            />
          </div>
        </section>

        <section className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">Lokalizacje</h2>
          <div className="mt-3">
            <BarChart
              items={dashboard.byVenue.map((v) => ({
                label: v.venue,
                seats: v.seats,
              }))}
              labelKey="label"
              valueKey="seats"
            />
          </div>
        </section>

        <section className="rounded-md border bg-white p-4">
          <h2 className="font-semibold">Instruktorzy</h2>
          <div className="mt-3">
            <BarChart
              items={dashboard.byInstructor.map((i) => ({
                label: i.name,
                seats: i.seats,
              }))}
              labelKey="label"
              valueKey="seats"
            />
          </div>
        </section>
      </div>

      <section className="overflow-x-auto rounded-md border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Termin</th>
              <th className="px-3 py-2">Miejsca</th>
              <th className="px-3 py-2">Obecni</th>
              <th className="px-3 py-2">No-show</th>
              <th className="px-3 py-2">Flagi</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {dashboard.sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-gray-500">
                  Brak terminów w wybranym okresie.
                </td>
              </tr>
            ) : (
              dashboard.sessions.map((s) => (
                <tr key={s.sessionId} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(s.startsAt).toLocaleString('pl-PL', {
                        timeZone: 'Europe/Warsaw',
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {s.seats}/{s.capacity}
                  </td>
                  <td className="px-3 py-2">{s.checkedIn}</td>
                  <td className="px-3 py-2">{s.noShows}</td>
                  <td className="px-3 py-2 text-xs text-amber-800">
                    {s.flags.join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/terminy/${s.sessionId}`}
                      className="underline"
                    >
                      Otwórz
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <p className="text-xs text-gray-500">
        Analityka nie mierzy konwersji strony, atrybucji marketingowej ani
        marży. Szczegóły: <code>docs/ANALYTICS.md</code>.
      </p>
    </div>
  );
}
