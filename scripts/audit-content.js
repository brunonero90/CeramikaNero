'use strict';

/**
 * Launch-blocking content audit for Ceramika Nero.
 * Exit 1 when blocking errors are found.
 *
 * Usage: node scripts/audit-content.js
 * Env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (or PUBLISHABLE for read-only checks)
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Node 20 + supabase-js 2.110 requires a WebSocket constructor even for REST-only use.
try {
  // eslint-disable-next-line global-require
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

async function main() {
  if (!url || !key) {
    console.error('Missing Supabase URL/key — cannot audit live content.');
    process.exit(2);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: workshops, error: wErr }, { data: sessions, error: sErr }, { data: products, error: pErr }] =
    await Promise.all([
      supabase
        .from('workshops')
        .select(
          'id, slug, title, status, booking_mode, default_price_gross_grosz, archived_at, category_id'
        ),
      supabase
        .from('workshop_sessions')
        .select(
          'id, workshop_id, starts_at, ends_at, status, capacity, reserved_count, price_gross_grosz, venue_key, location_name'
        ),
      supabase
        .from('products')
        .select(
          'id, sku, slug, title, status, product_type, price_gross_grosz, requires_shipping, allows_pickup, shipping_fee_mode, archived_at'
        ),
    ]);

  if (wErr) err(`workshops query failed: ${wErr.message}`);
  if (sErr) err(`sessions query failed: ${sErr.message}`);
  if (pErr) err(`products query failed: ${pErr.message}`);

  const ws = workshops ?? [];
  const ss = sessions ?? [];
  const ps = products ?? [];

  const slugCounts = new Map();
  for (const w of ws) {
    slugCounts.set(w.slug, (slugCounts.get(w.slug) || 0) + 1);
  }
  for (const [slug, count] of slugCounts) {
    if (count > 1) err(`Duplicate workshop slug: ${slug} (${count})`);
  }

  const published = ws.filter((w) => w.status === 'published' && !w.archived_at);
  for (const w of published) {
    if (!['scheduled', 'enquiry', 'external'].includes(w.booking_mode)) {
      err(`Published workshop ${w.slug} has invalid booking_mode=${w.booking_mode}`);
    }
    if (w.booking_mode === 'scheduled') {
      const upcoming = ss.filter(
        (s) =>
          s.workshop_id === w.id &&
          s.status === 'scheduled' &&
          new Date(s.starts_at).getTime() > Date.now()
      );
      if (upcoming.length === 0) {
        warn(
          `Scheduled published workshop ${w.slug} has no upcoming scheduled sessions`
        );
      }
    }
  }

  const validVenues = new Set(['suchy-las', 'ptasie-radio', 'other', null]);
  for (const s of ss) {
    if (s.status === 'scheduled' || s.status === 'sold_out') {
      if (!s.capacity || s.capacity < 1) {
        err(`Session ${s.id} missing capacity`);
      }
      if (s.reserved_count > s.capacity) {
        err(`Session ${s.id} reserved_count > capacity`);
      }
      if (s.price_gross_grosz == null || s.price_gross_grosz < 0) {
        err(`Session ${s.id} missing/invalid price`);
      }
      if (!s.starts_at || !s.ends_at) {
        err(`Session ${s.id} missing start/end`);
      }
      if (s.venue_key && !validVenues.has(s.venue_key)) {
        err(`Session ${s.id} invalid venue_key=${s.venue_key}`);
      }
      if (!s.venue_key && !s.location_name) {
        warn(`Session ${s.id} has no venue_key or location_name`);
      }
    }
  }

  // Likely duplicate sessions: same workshop + same start minute
  const startKeys = new Map();
  for (const s of ss.filter((x) => x.status !== 'cancelled')) {
    const key = `${s.workshop_id}|${String(s.starts_at).slice(0, 16)}`;
    startKeys.set(key, (startKeys.get(key) || 0) + 1);
  }
  for (const [key, count] of startKeys) {
    if (count > 1) err(`Likely duplicate sessions: ${key} (${count})`);
  }

  const glina = ps.find((p) => p.slug === 'glina-box' || p.sku === 'GLINA-BOX');
  const firing = ps.find(
    (p) =>
      p.slug === 'szkliwienie-prac-w-pracowni' || p.sku === 'SZKLIWIENIE-PRACOWNIA'
  );

  if (!glina) {
    err('Glina Box product missing');
  } else {
    if (glina.price_gross_grosz !== 22900) {
      err(
        `Glina Box price must be 22900 grosz, found ${glina.price_gross_grosz}`
      );
    }
    if (glina.status === 'published' && glina.archived_at) {
      err('Glina Box published but archived_at set');
    }
    if (glina.price_gross_grosz === 13700) {
      err('Obsolete 137 zł Glina Box promotion price is live');
    }
  }

  if (ss.length === 0) {
    warn(
      'No workshop_sessions rows in database — calendar/checkout for scheduled workshops cannot work until real sessions exist'
    );
  }

  if (!firing) {
    err('Firing/glazing service product missing');
  } else if (firing.price_gross_grosz !== 6900) {
    err(
      `Firing service price must be 6900 grosz, found ${firing.price_gross_grosz}`
    );
  }

  if (glina && firing && glina.id === firing.id) {
    err('Glina Box and firing service must be separate products');
  }

  console.log('Content audit');
  console.log(`  workshops: ${ws.length} (published ${published.length})`);
  console.log(`  sessions: ${ss.length}`);
  console.log(`  products: ${ps.length}`);
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(
    errors.length
      ? `FAILED with ${errors.length} blocking error(s), ${warnings.length} warning(s)`
      : `OK (${warnings.length} warning(s))`
  );
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
