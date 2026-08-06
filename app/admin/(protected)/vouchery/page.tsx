import { createHash, randomUUID } from 'node:crypto';
import Link from 'next/link';
import { requireAnyRole } from '@/lib/admin/auth';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { formatPrice } from '@/lib/utils/price';
import {
  cancelVoucherAction,
  extendVoucherAction,
  refundVoucherOrderAction,
} from './actions';
import { VoucherIssueForm } from './VoucherIssueForm';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  q?: string;
  provider?: string;
  status?: string;
}>;

function normalizeCode(value: string): string {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function codeHash(value: string): string {
  return createHash('sha256').update(normalizeCode(value)).digest('hex');
}

function formatDate(value: string | null): string {
  if (!value) return 'bezterminowo';
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Warsaw',
  }).format(new Date(value));
}

export default async function AdminVouchersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAnyRole(['owner', 'manager']);
  const params = await searchParams;
  const queryText = (params.q ?? '').trim();
  const provider = (params.provider ?? '').trim();
  const status = (params.status ?? '').trim();
  const supabase = createCartAdminClient() as unknown as {
    from: (table: string) => any;
  };

  let query = supabase
    .from('gift_vouchers')
    .select(
      `
      id, provider_code, code_last4, voucher_type, description,
      original_value_grosz, remaining_value_grosz, currency,
      valid_from, valid_until, status, multi_use, refund_policy,
      allowed_workshop_types, allowed_workshop_ids, external_reference,
      created_at, updated_at,
      gift_voucher_providers (name),
      voucher_redemptions (
        id, order_id, amount_grosz, status, remaining_after_grosz,
        reserved_at, committed_at, released_at, refunded_at,
        orders (order_reference, status, payment_status, selected_payment_method, fulfillment_status)
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (provider) query = query.eq('provider_code', provider);
  if (status) query = query.eq('status', status);
  if (queryText) {
    const normalized = normalizeCode(queryText);
    const terms = [
      `code_last4.ilike.%${normalized.slice(-4)}%`,
      `description.ilike.%${queryText}%`,
      `external_reference.ilike.%${queryText}%`,
    ];
    if (normalized.length >= 4) terms.push(`code_hash.eq.${codeHash(normalized)}`);
    query = query.or(terms.join(','));
  }

  const { data, error } = await query;
  if (error) console.error('admin vouchers list failed', error.message);
  const vouchers = (data ?? []) as any[];

  const { data: secrets } = await supabase
    .from('voucher_issue_secrets')
    .select(
      'voucher_id, raw_code, reason, created_at, gift_vouchers(code_last4, description, status)'
    )
    .is('revealed_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bony upominkowe</h1>
          <p className="text-sm text-gray-600">
            Bony są księgowane jako metoda płatności i mają własny audyt salda.
          </p>
        </div>
        <Link
          href="/admin/vouchery/export"
          className="border px-3 py-2 text-sm font-medium"
        >
          Eksport CSV
        </Link>
      </div>

      <VoucherIssueForm />

      {(secrets ?? []).length ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">
            Kody wygenerowane automatycznie — przekaż klientom
          </h2>
          <p className="mb-3 text-sm text-amber-900">
            Dotyczy także bonów zastępczych po zwrocie. Nie wysyłaj kodów w
            publicznych notatkach.
          </p>
          <div className="space-y-2">
            {(secrets ?? []).map((secret: any) => (
              <div key={secret.voucher_id} className="rounded bg-white p-3 text-sm">
                <p className="select-all font-mono font-semibold">
                  {secret.raw_code}
                </p>
                <p className="text-gray-600">
                  {secret.reason} · ••••{secret.gift_vouchers?.code_last4} ·{' '}
                  {secret.gift_vouchers?.description ?? 'bez opisu'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-4">
        <input
          name="q"
          defaultValue={queryText}
          placeholder="Kod, 4 ostatnie znaki, opis…"
          className="border px-3 py-2 text-sm md:col-span-2"
        />
        <select
          name="provider"
          defaultValue={provider}
          className="border px-3 py-2 text-sm"
        >
          <option value="">Wszyscy wystawcy</option>
          <option value="ceramika_nero">Ceramika Nero</option>
          <option value="prezent_marzen">Prezent Marzeń</option>
        </select>
        <select
          name="status"
          defaultValue={status}
          className="border px-3 py-2 text-sm"
        >
          <option value="">Wszystkie statusy</option>
          <option value="active">Aktywny</option>
          <option value="partially_redeemed">Częściowo użyty</option>
          <option value="redeemed">Wykorzystany</option>
          <option value="expired">Wygasły</option>
          <option value="cancelled">Anulowany</option>
        </select>
        <button className="bg-gray-900 px-4 py-2 text-sm font-semibold text-white md:col-span-4 md:w-fit">
          Filtruj
        </button>
      </form>

      <div className="space-y-4">
        {vouchers.length ? (
          vouchers.map((voucher) => {
            const providerName = Array.isArray(voucher.gift_voucher_providers)
              ? voucher.gift_voucher_providers[0]?.name
              : voucher.gift_voucher_providers?.name;
            const redemptions = voucher.voucher_redemptions ?? [];
            return (
              <article key={voucher.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {providerName ?? voucher.provider_code} · ••••{voucher.code_last4}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {voucher.description ?? voucher.voucher_type}
                    </p>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold">
                    {voucher.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-gray-500">Saldo</dt>
                    <dd className="font-semibold">
                      {formatPrice(voucher.remaining_value_grosz)} /{' '}
                      {formatPrice(voucher.original_value_grosz)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Ważność</dt>
                    <dd>{formatDate(voucher.valid_until)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Użycie</dt>
                    <dd>{voucher.multi_use ? 'wielokrotne' : 'jednorazowe'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Zwrot</dt>
                    <dd>{voucher.refund_policy}</dd>
                  </div>
                </dl>

                {redemptions.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 pr-3">Zamówienie</th>
                          <th className="py-2 pr-3">Kwota</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {redemptions.map((redemption: any) => {
                          const order = Array.isArray(redemption.orders)
                            ? redemption.orders[0]
                            : redemption.orders;
                          return (
                            <tr key={redemption.id} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                {order?.order_reference ? (
                                  <Link
                                    href={`/admin/zamowienia/${redemption.order_id}`}
                                    className="underline"
                                  >
                                    {order.order_reference}
                                  </Link>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 pr-3">
                                {formatPrice(redemption.amount_grosz)}
                              </td>
                              <td className="py-2 pr-3">
                                {redemption.status}
                                {redemption.status === 'committed' &&
                                order?.selected_payment_method === 'voucher' &&
                                order?.status === 'confirmed' &&
                                order?.fulfillment_status === 'unfulfilled' ? (
                                  <form
                                    action={refundVoucherOrderAction}
                                    className="mt-2 flex min-w-64 gap-2"
                                  >
                                    <input type="hidden" name="orderId" value={redemption.order_id} />
                                    <input type="hidden" name="operationKey" value={randomUUID()} />
                                    <input
                                      required
                                      name="reason"
                                      maxLength={1000}
                                      placeholder="Powód zwrotu"
                                      className="min-w-0 flex-1 border px-2 py-1"
                                    />
                                    <button className="border border-red-300 px-2 py-1 font-semibold text-red-700">
                                      Zwróć bon
                                    </button>
                                  </form>
                                ) : null}
                              </td>
                              <td className="py-2">
                                {formatDate(redemption.reserved_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">Brak użyć.</p>
                )}

                <div className="mt-4 flex flex-wrap gap-3 border-t pt-3">
                  {voucher.status !== 'cancelled' && voucher.status !== 'redeemed' ? (
                    <form action={cancelVoucherAction}>
                      <input type="hidden" name="voucherId" value={voucher.id} />
                      <button className="border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">
                        Anuluj bon
                      </button>
                    </form>
                  ) : null}
                  <form action={extendVoucherAction} className="flex gap-2">
                    <input type="hidden" name="voucherId" value={voucher.id} />
                    <input
                      required
                      name="validUntil"
                      type="datetime-local"
                      className="border px-2 py-1 text-xs"
                    />
                    <button className="border px-3 py-2 text-xs font-semibold">
                      Przedłuż
                    </button>
                  </form>
                </div>
              </article>
            );
          })
        ) : (
          <p className="rounded-lg border bg-white p-6 text-center text-gray-500">
            {error ? 'Nie udało się pobrać bonów.' : 'Brak bonów.'}
          </p>
        )}
      </div>
    </div>
  );
}
