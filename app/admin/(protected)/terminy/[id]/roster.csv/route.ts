import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireAnyRole(['owner', 'manager']);
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from('workshop_sessions')
    .select('id, starts_at, workshops(title)')
    .eq('id', id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings } = await (supabase as any)
    .from('bookings')
    .select(
      `
      booking_reference,
      status,
      quantity,
      customer_profiles (first_name, last_name, email, phone),
      booking_participants (display_name, age, participant_type)
    `
    )
    .eq('workshop_session_id', id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });

  const rows = [
    [
      'reference',
      'status',
      'quantity',
      'purchaser',
      'email',
      'phone',
      'participant',
      'age',
      'type',
    ],
  ];

  for (const booking of bookings ?? []) {
    const profile = Array.isArray(booking.customer_profiles)
      ? booking.customer_profiles[0]
      : booking.customer_profiles;
    const participants = (booking.booking_participants ?? []) as Array<{
      display_name: string | null;
      age: number | null;
      participant_type: string | null;
    }>;
    const purchaser = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
      : '';
    if (participants.length === 0) {
      rows.push([
        booking.booking_reference,
        booking.status,
        String(booking.quantity ?? ''),
        purchaser,
        profile?.email ?? '',
        profile?.phone ?? '',
        '',
        '',
        '',
      ]);
    } else {
      for (const p of participants) {
        rows.push([
          booking.booking_reference,
          booking.status,
          String(booking.quantity ?? ''),
          purchaser,
          profile?.email ?? '',
          profile?.phone ?? '',
          p.display_name ?? '',
          p.age != null ? String(p.age) : '',
          p.participant_type ?? '',
        ]);
      }
    }
  }

  const body = rows.map((r) => r.map((c) => csvEscape(String(c))).join(',')).join('\n');
  const workshopTitle = Array.isArray(session.workshops)
    ? session.workshops[0]?.title
    : (session.workshops as { title?: string } | null)?.title;
  const filename = `roster-${(workshopTitle || 'session').replace(/\s+/g, '-').slice(0, 40)}-${id.slice(0, 8)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
