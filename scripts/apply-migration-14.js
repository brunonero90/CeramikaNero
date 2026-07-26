'use strict';

/**
 * Apply migration 14 (orders.tracking_reference) via PostgREST-incompatible
 * path: uses service role + rpc only if available; otherwise prints SQL for
 * the Supabase SQL Editor.
 *
 * Preferred: Bruno pastes the migration file into SQL Editor once.
 */
const fs = require('fs');
const path = require('path');

try {
  globalThis.WebSocket = require('ws');
} catch {
  /* optional */
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
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
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    'supabase/migrations/00000000000014_order_tracking_reference.sql'
  );
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env — paste migration 14 in SQL Editor:');
    console.log(sql);
    process.exit(2);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Probe: column present?
  const probe = await supabase
    .from('orders')
    .select('tracking_reference')
    .limit(1);
  if (!probe.error) {
    console.log('migration 14 already applied (tracking_reference readable)');
    process.exit(0);
  }

  console.log(
    'tracking_reference missing. Apply this SQL in Supabase SQL Editor for zorxzyvmcbwucvaywmuu:\n'
  );
  console.log(sql);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
