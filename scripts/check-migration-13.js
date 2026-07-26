'use strict';

/**
 * Non-destructive check: is migration 13 present on the remote project?
 * Exit 0 = applied, 1 = missing pieces, 2 = cannot connect.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(2);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const enquiries = await supabase.from('enquiries').select('id').limit(1);
  const events = await supabase.from('enquiry_events').select('id').limit(1);

  console.log('project url', url);
  console.log(
    'enquiries',
    enquiries.error ? `MISSING/ERR: ${enquiries.error.message}` : 'ok'
  );
  console.log(
    'enquiry_events',
    events.error ? `MISSING/ERR: ${events.error.message}` : 'ok'
  );

  const missing =
    Boolean(enquiries.error) || Boolean(events.error);
  process.exit(missing ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
