'use strict';

/**
 * Smoke-book one seat on the next published Ceramika dla dorosłych session,
 * verify capacity + idempotency, then cancel the booking (keeps the session).
 *
 *   node scripts/smoke-live-booking.js
 */
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { createClient } = require('@supabase/supabase-js');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

function idemKey(sessionId, email, quantity, first, last) {
  return createHash('sha256')
    .update(
      [
        sessionId,
        email.toLowerCase(),
        String(quantity),
        first.toLowerCase(),
        last.toLowerCase(),
      ].join('|')
    )
    .digest('hex');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = { at: new Date().toISOString(), steps: [] };

  const { data: workshop, error: wErr } = await admin
    .from('workshops')
    .select('id, slug, title')
    .eq('slug', 'ceramika-dla-doroslych')
    .eq('status', 'published')
    .single();
  if (wErr || !workshop) throw new Error('Published workshop missing');

  const { data: session, error: sErr } = await admin
    .from('workshop_sessions')
    .select('*')
    .eq('workshop_id', workshop.id)
    .eq('status', 'scheduled')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sErr || !session) {
    throw new Error('No future session for ceramika-dla-doroslych');
  }

  report.sessionId = session.id;
  report.startsAt = session.starts_at;
  report.reservedBefore = session.reserved_count;

  const email = `live-smoke-${Date.now()}@ceramikanero.local`;
  const first = 'Smoke';
  const last = 'Test';
  const quantity = 1;
  const keyHash = idemKey(session.id, email, quantity, first, last);
  const participants = [
    {
      display_name: 'Smoke Test',
      age: 30,
      participant_type: 'adult',
      accessibility_notes: null,
    },
  ];

  const payload = {
    p_session_id: session.id,
    p_quantity: quantity,
    p_customer_email: email,
    p_customer_first_name: first,
    p_customer_last_name: last,
    p_customer_phone: '600000000',
    p_customer_notes: '[LIVE-SMOKE] auto test — cancelled after verify',
    p_marketing_consent: false,
    p_terms_accepted_at: new Date().toISOString(),
    p_privacy_policy_version: '1.0',
    p_participants: participants,
    p_source: 'website',
    p_payment_provider: 'bank_transfer',
    p_payment_status: 'pending',
    p_status: 'awaiting_payment',
    p_idempotency_key: keyHash,
  };

  const { data: firstResult, error: bErr } = await admin.rpc(
    'begin_booking',
    payload
  );
  if (bErr) throw bErr;
  report.first = firstResult;
  report.steps.push('begin_booking');

  const { data: after } = await admin
    .from('workshop_sessions')
    .select('reserved_count')
    .eq('id', session.id)
    .single();
  report.reservedAfter = after?.reserved_count;
  if (after?.reserved_count !== session.reserved_count + 1) {
    throw new Error(
      `Capacity mismatch: before=${session.reserved_count} after=${after?.reserved_count}`
    );
  }
  report.steps.push('capacity_ok');

  const { data: again, error: againErr } = await admin.rpc(
    'begin_booking',
    payload
  );
  if (againErr) throw againErr;
  report.second = again;
  if (
    again?.booking_reference &&
    firstResult?.booking_reference &&
    again.booking_reference !== firstResult.booking_reference
  ) {
    throw new Error('Idempotent retry created a different booking');
  }
  report.steps.push('idempotent_ok');

  const bookingId = firstResult?.booking_id;
  if (!bookingId) throw new Error('Missing booking_id on begin_booking result');

  const { error: cErr } = await admin.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_cancelled_by: 'system',
    p_reason: 'LIVE-SMOKE cleanup',
  });
  if (cErr) throw cErr;
  report.steps.push('cancelled');

  const { data: finalSession } = await admin
    .from('workshop_sessions')
    .select('reserved_count')
    .eq('id', session.id)
    .single();
  report.reservedFinal = finalSession?.reserved_count;
  report.bookingReference = firstResult.booking_reference;

  const outDir = path.join(process.cwd(), 'tmp/overnight-completion');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'live-smoke-booking-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
