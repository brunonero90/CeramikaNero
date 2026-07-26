import { NextResponse } from 'next/server';
import { dispatchPendingBookingEmails } from '@/lib/booking/email-dispatch';
import { dispatchPendingOrderEmails } from '@/lib/cart/order-email-dispatch';

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
    const [bookings, orders] = await Promise.all([
      dispatchPendingBookingEmails(20),
      dispatchPendingOrderEmails(20),
    ]);
    return NextResponse.json({
      ok: true,
      bookings,
      orders,
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
