/**
 * Controlled smoke test against linked Supabase (service role from .env).
 * Creates one booking on the [SMOKE-TEST] session, verifies capacity + idempotency,
 * then optionally cleans up with --cleanup.
 *
 * Usage:
 *   node scripts/smoke-booking-supabase.js
 *   node scripts/smoke-booking-supabase.js --cleanup
 */
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

function idemKey(sessionId, email, quantity, first, last) {
  return createHash('sha256')
    .update(
      [sessionId, email.toLowerCase(), String(quantity), first.toLowerCase(), last.toLowerCase()].join('|')
    )
    .digest('hex');
}

async function main() {
  const env = loadEnv();
  const cleanup = process.argv.includes('--cleanup');
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = {
    at: new Date().toISOString(),
    projectHost: new URL(url).host,
    steps: [],
  };

  const { data: workshop, error: wErr } = await admin
    .from('workshops')
    .select('id, slug, title')
    .eq('slug', 'smoke-test-ceramika-dla-doroslych')
    .single();
  if (wErr || !workshop) throw new Error('Smoke workshop missing — run scripts/seed-smoke-session.sql');

  const { data: session, error: sErr } = await admin
    .from('workshop_sessions')
    .select('*')
    .eq('workshop_id', workshop.id)
    .eq('location_name', 'Suchy Las (SMOKE-TEST)')
    .eq('status', 'scheduled')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (sErr || !session) throw new Error('Smoke session missing');

  report.sessionId = session.id;
  report.reservedBefore = session.reserved_count;

  if (cleanup) {
    const { data: bookings } = await admin
      .from('bookings')
      .select('id, booking_reference')
      .eq('workshop_session_id', session.id);
    for (const b of bookings ?? []) {
      await admin.rpc('cancel_booking', {
        p_booking_id: b.id,
        p_cancelled_by: 'system',
        p_reason: 'SMOKE-TEST cleanup',
      });
      report.steps.push({ cancel: b.booking_reference });
    }
    await admin
      .from('workshop_sessions')
      .delete()
      .eq('id', session.id);
    await admin.from('workshops').delete().eq('id', workshop.id);
    await admin.from('workshop_categories').delete().eq('slug', 'smoke-test-category');
    await admin
      .from('customer_profiles')
      .delete()
      .ilike('email', 'smoke-test%@ceramikanero.local');
    report.cleaned = true;
    fs.mkdirSync('tmp/overnight-completion', { recursive: true });
    fs.writeFileSync(
      'tmp/overnight-completion/smoke-booking-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const email = 'smoke-test.go-live@ceramikanero.local';
  const first = 'Smoke';
  const last = 'Tester';
  const quantity = 1;
  const keyHash = idemKey(session.id, email, quantity, first, last);

  const participants = [
    {
      display_name: 'Smoke Tester',
      age: 30,
      participant_type: 'adult',
      accessibility_notes: null,
    },
  ];

  const { data: firstResult, error: firstErr } = await admin.rpc('begin_booking', {
    p_session_id: session.id,
    p_quantity: quantity,
    p_customer_email: email,
    p_customer_first_name: first,
    p_customer_last_name: last,
    p_customer_phone: '600000000',
    p_customer_notes: '[SMOKE-TEST] controlled go-live booking',
    p_marketing_consent: false,
    p_terms_accepted_at: new Date().toISOString(),
    p_privacy_policy_version: '1.0',
    p_participants: participants,
    p_source: 'website',
    p_payment_provider: 'bank_transfer',
    p_payment_status: 'pending',
    p_status: 'awaiting_payment',
    p_idempotency_key: keyHash,
  });
  if (firstErr) throw firstErr;
  report.first = firstResult;
  report.steps.push('begin_booking_ok');

  const { data: after } = await admin
    .from('workshop_sessions')
    .select('reserved_count')
    .eq('id', session.id)
    .single();
  report.reservedAfterFirst = after?.reserved_count;
  if (after?.reserved_count !== session.reserved_count + 1) {
    throw new Error(
      `Capacity mismatch: before=${session.reserved_count} after=${after?.reserved_count}`
    );
  }
  report.steps.push('capacity_incremented_once');

  const { data: secondResult, error: secondErr } = await admin.rpc('begin_booking', {
    p_session_id: session.id,
    p_quantity: quantity,
    p_customer_email: email,
    p_customer_first_name: first,
    p_customer_last_name: last,
    p_customer_phone: '600000000',
    p_customer_notes: '[SMOKE-TEST] controlled go-live booking',
    p_marketing_consent: false,
    p_terms_accepted_at: new Date().toISOString(),
    p_privacy_policy_version: '1.0',
    p_participants: participants,
    p_source: 'website',
    p_payment_provider: 'bank_transfer',
    p_payment_status: 'pending',
    p_status: 'awaiting_payment',
    p_idempotency_key: keyHash,
  });
  if (secondErr) throw secondErr;
  report.second = secondResult;
  if (!secondResult?.reused && secondResult?.booking_id !== firstResult?.booking_id) {
    // reused flag may be present after migration 09
    if (secondResult?.booking_reference !== firstResult?.booking_reference) {
      throw new Error('Idempotent retry created a different booking');
    }
  }
  report.steps.push('idempotent_retry_ok');

  const { data: after2 } = await admin
    .from('workshop_sessions')
    .select('reserved_count')
    .eq('id', session.id)
    .single();
  report.reservedAfterRetry = after2?.reserved_count;
  if (after2?.reserved_count !== after?.reserved_count) {
    throw new Error('Capacity changed on idempotent retry');
  }
  report.steps.push('capacity_stable_on_retry');

  // Anon should not read bookings
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: anonBookings, error: anonErr } = await anon.from('bookings').select('id').limit(5);
  report.anonBookingsCount = (anonBookings ?? []).length;
  report.anonBookingsError = anonErr?.message ?? null;
  if ((anonBookings ?? []).length > 0) {
    throw new Error('Anon was able to read bookings');
  }
  report.steps.push('anon_cannot_read_bookings');

  const { data: publicSessions, error: pubErr } = await anon
    .from('workshop_sessions')
    .select('id, status')
    .eq('id', session.id);
  if (pubErr) throw pubErr;
  report.publicCanReadSmokeSession = (publicSessions ?? []).length === 1;
  if (!report.publicCanReadSmokeSession) {
    throw new Error('Anon cannot read published smoke session');
  }
  report.steps.push('anon_can_read_published_session');

  report.ok = true;
  fs.mkdirSync('tmp/overnight-completion', { recursive: true });
  fs.writeFileSync(
    'tmp/overnight-completion/smoke-booking-report.json',
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
