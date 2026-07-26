import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';

export const dynamic = 'force-dynamic';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  await requireAnyRole(['owner', 'manager']);
  const url = new URL(request.url);
  const status = url.searchParams.get('status')?.trim() || '';
  const q = url.searchParams.get('q')?.trim() || '';

  const supabase = createCartAdminClient();
  let query = supabase
    .from('enquiries')
    .select(
      'reference, status, offer_key, offer_title, customer_name, customer_email, customer_phone, preferred_contact, participant_count, preferred_date_text, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (status) query = query.eq('status', status);
  if (q) {
    query = query.or(
      `reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%,offer_key.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }

  const header = [
    'reference',
    'status',
    'offer_key',
    'offer_title',
    'customer_name',
    'customer_email',
    'customer_phone',
    'preferred_contact',
    'participant_count',
    'preferred_date_text',
    'created_at',
  ];
  const rows = [header];
  for (const row of data ?? []) {
    rows.push([
      row.reference ?? '',
      row.status ?? '',
      row.offer_key ?? '',
      row.offer_title ?? '',
      row.customer_name ?? '',
      row.customer_email ?? '',
      row.customer_phone ?? '',
      row.preferred_contact ?? '',
      row.participant_count != null ? String(row.participant_count) : '',
      row.preferred_date_text ?? '',
      row.created_at ?? '',
    ]);
  }

  const body = rows.map((r) => r.map((c) => csvEscape(String(c))).join(',')).join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="zapytania.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
