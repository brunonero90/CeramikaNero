'use strict';

/**
 * Idempotent operational seed for Ceramika Nero.
 *
 * Default: dry-run only (no mutations).
 *
 * Guards:
 * - Refuses unidentified targets
 * - Refuses production unless BRUNO_CONFIRM_PRODUCTION=1 and matching project ref
 * - Does not seed customers, bookings, payments, or owner accounts
 * - Provisional prices/schedules are excluded unless --include-provisional
 *
 * Usage:
 *   node scripts/seed-operational-data.js
 *   node scripts/seed-operational-data.js --apply
 *   node scripts/seed-operational-data.js --apply --include-provisional
 *
 * Required for --apply:
 *   SEED_CONFIRM_PROJECT_REF=<exact project ref from NEXT_PUBLIC_SUPABASE_URL>
 *   SEED_ENV=development|staging|production
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY
 */
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

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const INCLUDE_PROVISIONAL = args.has('--include-provisional');

const CATEGORIES = [
  {
    name: 'Dla dzieci',
    slug: 'dla-dzieci',
    description: 'Warsztaty ceramiczne dla najmłodszych artystów.',
    suggested_theme: 'joyful',
    display_order: 10,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Dla dorosłych',
    slug: 'dla-doroslych',
    description: 'Warsztaty i kursy ceramiczne dla dorosłych.',
    suggested_theme: 'atelier',
    display_order: 20,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Rodzinne',
    slug: 'rodzinne',
    description: 'Wspólne tworzenie dla rodziców i dzieci.',
    suggested_theme: 'joyful',
    display_order: 30,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Glina do wina',
    slug: 'glina-do-wina',
    description: 'Wieczorne warsztaty ceramiczne z lampką wina.',
    suggested_theme: 'atelier',
    display_order: 40,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Urodziny',
    slug: 'urodziny',
    description: 'Urodzinowe warsztaty ceramiczne dla dzieci i dorosłych.',
    suggested_theme: 'joyful',
    display_order: 50,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Grupy i firmy',
    slug: 'grupy-i-firmy',
    description: 'Warsztaty integracyjne dla grup i firm.',
    suggested_theme: 'atelier',
    display_order: 60,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Wieczory panieńskie',
    slug: 'wieczory-panienskie',
    description: 'Kreatywne spotkania dla przyszłej panny młodej i gości.',
    suggested_theme: 'joyful',
    display_order: 70,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
  {
    name: 'Półkolonie i wydarzenia',
    slug: 'polkolonie-i-wydarzenia',
    description: 'Półkolonie oraz sezonowe wydarzenia ceramiczne.',
    suggested_theme: 'joyful',
    display_order: 80,
    provenance: 'supabase/seed.sql + lib/database/fixtures/data.ts',
  },
];

const SITE_SETTINGS = [
  {
    key: 'studio_name',
    value: 'Pracownia ceramiki Nero',
    provenance: 'archive siteContact.brand',
  },
  {
    key: 'studio_address',
    value: 'ul. Podgórna 3, Suchy Las 62-002',
    provenance: 'archive siteContact address lines',
  },
  {
    key: 'studio_email',
    value: 'nerogosia@gmail.com',
    provenance: 'archive siteContact.email',
  },
  {
    key: 'studio_phone',
    value: '+48532279101',
    provenance: 'archive siteContact.phoneHref',
  },
  {
    key: 'booking_cta_label',
    value: 'Zarezerwuj warsztat',
    provenance: 'supabase/seed.sql + fixtures',
  },
];

const MISSING_FOR_BRUNO = [
  {
    entity: 'workshop_sessions',
    reason:
      'Existing seed.sql / fixtures use provisional future dates not proven from the live archive schedule.',
  },
  {
    entity: 'workshops.default_price_gross_grosz',
    reason:
      'Fixture/seed prices are marked provisional; homepage archive shows offer prices but not a verified DB catalog mapping.',
  },
  {
    entity: 'instructors display names',
    reason:
      'Fixtures use Ania Nero / Kasia Nero; public archive contact uses Małgorzata Nero — needs owner confirmation before seeding instructors.',
  },
  {
    entity: 'published workshop catalog rows',
    reason:
      'Do not invent workshop rows beyond categories/settings without confirmed titles, capacities and booking modes.',
  },
];

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function summarize(counts) {
  return counts;
}

async function upsertCategories(client, dryRun) {
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const cat of CATEGORIES) {
    const { data: existing, error } = await client
      .from('workshop_categories')
      .select('id, name, slug')
      .eq('slug', cat.slug)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      result.skipped += 1;
      continue;
    }
    if (dryRun) {
      result.inserted += 1;
      continue;
    }
    const { error: insErr } = await client.from('workshop_categories').insert({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      suggested_theme: cat.suggested_theme,
      display_order: cat.display_order,
      is_visible: true,
    });
    if (insErr) throw insErr;
    result.inserted += 1;
  }
  return result;
}

async function upsertSettings(client, dryRun) {
  const result = { inserted: 0, updated: 0, skipped: 0 };
  for (const setting of SITE_SETTINGS) {
    const { data: existing, error } = await client
      .from('site_settings')
      .select('key, value')
      .eq('key', setting.key)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      result.skipped += 1;
      continue;
    }
    if (dryRun) {
      result.inserted += 1;
      continue;
    }
    const { error: insErr } = await client.from('site_settings').insert({
      key: setting.key,
      value: setting.value,
    });
    if (insErr) throw insErr;
    result.inserted += 1;
  }
  return result;
}

async function integrity(client) {
  const [{ count: catCount }, { count: wsCount }, { count: sessCount }] =
    await Promise.all([
      client
        .from('workshop_categories')
        .select('*', { count: 'exact', head: true }),
      client.from('workshops').select('*', { count: 'exact', head: true }),
      client
        .from('workshop_sessions')
        .select('*', { count: 'exact', head: true }),
    ]);
  return {
    workshop_categories: catCount,
    workshops: wsCount,
    workshop_sessions: sessCount,
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const confirmRef = process.env.SEED_CONFIRM_PROJECT_REF;
  const seedEnv = (process.env.SEED_ENV || '').toLowerCase();

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    includeProvisional: INCLUDE_PROVISIONAL,
    target: null,
    guards: [],
    blocked: false,
    categories: null,
    site_settings: null,
    missingForBruno: MISSING_FOR_BRUNO,
    integrityBefore: null,
    integrityAfter: null,
  };

  if (!url || !secret) {
    report.blocked = true;
    report.guards.push(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY'
    );
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  report.target = {
    projectRef: ref,
    host: new URL(url).host,
    seedEnv: seedEnv || null,
  };

  if (!ref) {
    report.blocked = true;
    report.guards.push('Could not parse Supabase project ref from URL');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // Docs treat this project as the studio production foundation.
  const docsProductionRef = 'zorxzyvmcbwucvaywmuu';
  const looksProduction =
    seedEnv === 'production' ||
    (ref === docsProductionRef &&
      seedEnv !== 'development' &&
      seedEnv !== 'staging');

  if (APPLY) {
    if (!confirmRef) {
      report.blocked = true;
      report.guards.push(
        'SEED_CONFIRM_PROJECT_REF is required for --apply and must equal the URL project ref'
      );
    } else if (confirmRef !== ref) {
      report.blocked = true;
      report.guards.push(
        `SEED_CONFIRM_PROJECT_REF (${confirmRef}) does not match URL project ref (${ref})`
      );
    }
    if (!['development', 'staging', 'production'].includes(seedEnv)) {
      report.blocked = true;
      report.guards.push(
        'SEED_ENV must be development|staging|production for --apply'
      );
    }
    if (looksProduction && process.env.BRUNO_CONFIRM_PRODUCTION !== '1') {
      report.blocked = true;
      report.guards.push(
        `Target ${ref} requires BRUNO_CONFIRM_PRODUCTION=1 (docs list this ref as the production foundation; SEED_ENV=${seedEnv || 'unset'})`
      );
    }
    if (INCLUDE_PROVISIONAL) {
      report.blocked = true;
      report.guards.push(
        'Provisional workshop prices/sessions are not applied automatically — provide confirmed business data first'
      );
    }
  }

  if (report.blocked) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  report.integrityBefore = await integrity(client);
  report.categories = await upsertCategories(client, !APPLY);
  report.site_settings = await upsertSettings(client, !APPLY);
  report.integrityAfter = APPLY
    ? await integrity(client)
    : report.integrityBefore;
  report.counts = {
    categories: summarize(report.categories),
    site_settings: summarize(report.site_settings),
  };

  const outDir = path.join(process.cwd(), 'tmp/fidelity-repair');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'seed-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
