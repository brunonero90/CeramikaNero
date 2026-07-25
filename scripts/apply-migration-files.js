/**
 * Apply local SQL migration files to the linked Postgres database.
 *
 * Usage:
 *   set DATABASE_URL=postgresql://...
 *   node scripts/apply-migration-files.js 00000000000011_cart_orders_products.sql
 *   node scripts/apply-migration-files.js 00000000000012_ptasie_radio_and_products_seed.sql
 *
 * Never use supabase/seed.sql against production.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const file = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!file || !databaseUrl) {
    console.error(
      'Usage: DATABASE_URL=... node scripts/apply-migration-files.js <migration-file.sql>'
    );
    process.exit(1);
  }
  const full = path.join(__dirname, '..', 'supabase', 'migrations', file);
  if (!fs.existsSync(full)) {
    console.error('Missing migration file', full);
    process.exit(1);
  }
  const sql = fs.readFileSync(full, 'utf8');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('commit');
    console.log('Applied', file);
  } catch (err) {
    await client.query('rollback');
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
