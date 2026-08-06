import { requireAnyRole } from '@/lib/admin/auth';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  await requireAnyRole(['owner', 'manager']);
  const supabase = createCartAdminClient() as unknown as {
    from: (table: string) => any;
  };
  const { data, error } = await supabase
    .from('gift_vouchers')
    .select(
      'provider_code, code_last4, voucher_type, description, original_value_grosz, remaining_value_grosz, currency, valid_from, valid_until, status, multi_use, refund_policy, external_reference, created_at'
    )
    .order('created_at', { ascending: false });

  if (error) {
    return new Response('Nie udało się wygenerować eksportu.', { status: 500 });
  }

  const header = [
    'provider',
    'masked_code',
    'type',
    'description',
    'original_value_grosz',
    'remaining_value_grosz',
    'currency',
    'valid_from',
    'valid_until',
    'status',
    'multi_use',
    'refund_policy',
    'external_reference',
    'created_at',
  ];
  const rows = (data ?? []).map((voucher: any) =>
    [
      voucher.provider_code,
      `••••${voucher.code_last4}`,
      voucher.voucher_type,
      voucher.description,
      voucher.original_value_grosz,
      voucher.remaining_value_grosz,
      voucher.currency,
      voucher.valid_from,
      voucher.valid_until,
      voucher.status,
      voucher.multi_use,
      voucher.refund_policy,
      voucher.external_reference,
      voucher.created_at,
    ]
      .map(csvCell)
      .join(',')
  );
  const csv = `\uFEFF${header.map(csvCell).join(',')}\n${rows.join('\n')}\n`;
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="ceramika-nero-vouchery-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
