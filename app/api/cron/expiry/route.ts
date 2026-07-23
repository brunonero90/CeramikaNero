import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function requireCronSecret(request: Request): boolean {
  const expected = process.env.BOOKING_CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${expected}`;
}

async function runExpiry(): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('expire_pending_bookings');
  if (error) {
    console.error('expire_pending_bookings failed', error);
    return NextResponse.json(
      { error: 'Expiry processing failed' },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    expired: data ?? [],
    processed_at: new Date().toISOString(),
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runExpiry();
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return runExpiry();
}
