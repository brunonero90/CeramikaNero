/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) {
      const [, key, value] = match;
      if (process.env[key] === undefined) {
        process.env[key] = value.trim();
      }
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env'
  );
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function queryTable(table, schema = 'public') {
  const { data, error } = await supabase
    .schema(schema)
    .from(table)
    .select('*', { count: 'exact', head: true });
  return { exists: !error, error: error?.message, count: data?.length };
}

async function main() {
  console.log('Project URL:', url);
  console.log('Project ref:', new URL(url).hostname.split('.')[0]);

  // Migration history
  const { data: migrations, error: migrationsError } = await supabase
    .schema('supabase_migrations')
    .from('schema_migrations')
    .select('version')
    .order('version', { ascending: true });

  if (migrationsError) {
    console.error(
      '\nCould not read migration history:',
      migrationsError.message
    );
  } else {
    console.log('\nRemote migration history:');
    (migrations || []).forEach((m) => console.log(`  ${m.version}`));
  }

  // Probe known tables
  const tables = [
    'workshops',
    'workshop_categories',
    'workshop_sessions',
    'instructors',
    'media_assets',
    'content_pages',
    'blog_posts',
    'gallery_items',
    'admin_users',
    'admin_audit_log',
  ];
  console.log('\nPublic table probe:');
  for (const table of tables) {
    const result = await queryTable(table);
    console.log(
      `  ${table}: ${result.exists ? 'exists' : `missing (${result.error})`}`
    );
  }

  // Storage buckets
  const { data: buckets, error: bucketsError } =
    await supabase.storage.listBuckets();
  if (bucketsError) {
    console.log('\nCould not list buckets:', bucketsError.message);
  } else {
    console.log('\nStorage buckets:');
    (buckets || []).forEach((b) =>
      console.log(`  ${b.name} (public=${b.public})`)
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
