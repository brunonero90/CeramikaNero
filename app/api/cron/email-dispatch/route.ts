import { NextResponse } from 'next/server';
import { dispatchPendingBookingEmails } from '@/lib/booking/email-dispatch';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireCronSecret(request: Request): boolean {
  const expected = process.env.BOOKING_CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

async function runDispatch(): Promise<NextResponse> {
  try {
    const summary = await dispatchPendingBookingEmails(20);
    return NextResponse.json({
      ok: true,
      ...summary,
      processed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('email-dispatch failed', error);
    return NextResponse.json(
      { error: 'Email dispatch failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runDispatch();
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runDispatch();
}
