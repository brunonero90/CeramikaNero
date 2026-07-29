import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { toCsv } from '@/lib/admin/csv';
import { loadSessionCockpit } from '@/lib/admin/session-cockpit';
import {
  humanAttendance,
  humanPaymentStatus,
} from '@/lib/admin/session-roster';
import { formatWarsawDateTime } from '@/lib/utils/datetime';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await requireAnyRole(['owner', 'manager']);
  const { id } = await context.params;
  const cockpit = await loadSessionCockpit(id);
  if (!cockpit) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const sessionLabel = `${cockpit.workshopTitle} | ${formatWarsawDateTime(cockpit.startsAt)}`;
  const headers = [
    'termin',
    'rezerwacja',
    'zamowienie',
    'status_rezerwacji',
    'status_platnosci',
    'kupujacy',
    'telefon',
    'email',
    'uczestnik',
    'wiek',
    'frekwencja',
    'notatki',
  ];

  const rows: Array<Array<string | number | null>> = [];
  const pushBooking = (
    b: (typeof cockpit.ready)[number],
    includeTerminal: boolean
  ) => {
    if (!includeTerminal && b.bucket === 'removed') return;
    const notes = [
      b.customerNotes ? `Klient: ${b.customerNotes}` : null,
      b.internalNotes ? `Wewn.: ${b.internalNotes}` : null,
      ...b.participants
        .filter((p) => p.accessibilityNotes)
        .map((p) => `Dostępność (${p.displayName ?? '?'}): ${p.accessibilityNotes}`),
    ]
      .filter(Boolean)
      .join(' | ');

    if (b.participants.length === 0) {
      rows.push([
        sessionLabel,
        b.bookingReference,
        b.orderReference,
        b.bookingStatus,
        humanPaymentStatus(b.paymentStatus),
        b.purchaserName,
        b.purchaserPhone,
        b.purchaserEmail,
        '',
        '',
        '',
        notes,
      ]);
      return;
    }
    for (const p of b.participants) {
      rows.push([
        sessionLabel,
        b.bookingReference,
        b.orderReference,
        b.bookingStatus,
        humanPaymentStatus(b.paymentStatus),
        b.purchaserName,
        b.purchaserPhone,
        b.purchaserEmail,
        p.displayName,
        p.age,
        humanAttendance(p.attendanceStatus),
        notes,
      ]);
    }
  };

  for (const b of [...cockpit.ready, ...cockpit.attention]) {
    pushBooking(b, false);
  }
  for (const b of cockpit.removed) {
    pushBooking(b, true);
  }

  const body = toCsv(headers, rows);
  const filename = `lista-${cockpit.workshopTitle.replace(/\s+/g, '-').slice(0, 40)}-${id.slice(0, 8)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
