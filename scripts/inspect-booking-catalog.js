'use strict';

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [{ data: workshops, error: wErr }, { data: sessions, error: sErr }, { data: cats }, { data: admins }] =
    await Promise.all([
      sb
        .from('workshops')
        .select('id,slug,status,booking_mode,title,default_price_gross_grosz')
        .order('slug'),
      sb
        .from('workshop_sessions')
        .select(
          'id,starts_at,status,capacity,reserved_count,location_name,price_gross_grosz,workshops(slug,title,status)'
        )
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(50),
      sb.from('workshop_categories').select('slug,name,is_visible').order('slug'),
      sb.from('admin_users').select('user_id,role,is_active,display_name'),
    ]);

  if (wErr) throw wErr;
  if (sErr) throw sErr;

  const report = {
    project: new URL(url).hostname,
    workshops: workshops ?? [],
    futureSessions: sessions ?? [],
    categories: cats ?? [],
    admins: admins ?? [],
  };
  const out = path.join(process.cwd(), 'tmp/overnight-completion');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, 'catalog-inspect.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
