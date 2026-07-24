'use strict';

/**
 * Dry-run (default) import of clone-page-v1 documents into content_pages.
 * Does NOT mutate unless --apply AND guards pass.
 *
 *   node scripts/import-clone-cms-content.js
 *   node scripts/import-clone-cms-content.js --apply
 *
 * Requires for --apply:
 *   SEED_CONFIRM_PROJECT_REF, SEED_ENV, and BRUNO_CONFIRM_PRODUCTION=1
 *   when targeting the production-foundation project.
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

const APPLY = process.argv.includes('--apply');
const DOCS_PRODUCTION_REF = 'zorxzyvmcbwucvaywmuu';

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  // Load registry via dynamic import of compiled TS is hard in plain node.
  // Instead read the dry-run catalog from a generated JSON preview built in-process
  // by requiring the vitest-friendly list written next to this script when tests run.
  // For Node dry-run we enumerate expected CMS slugs from a static list matching registry.
  const expectedSlugs = [
    'kontakt',
    'faq',
    'regulamin',
    'terms-conditions',
    'dostawy-i-zwroty',
    'sklep',
    'vouchery',
    'gift-card',
    'cart',
    'services',
    'glinadowina',
    'dla-dzieci',
    'dla-doroslych',
    'grupy-i-firmy',
    'pracownia',
    'galeria',
    'home',
  ];

  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    blocked: false,
    guards: [],
    target: null,
    architecture:
      'content_pages.content stores clone-page-v1 JSON; presentation stays in React',
    pagesProposed: expectedSlugs,
    pageCount: expectedSlugs.length,
    note: 'Static fixtures remain the live fallback until Bruno approves apply. No production mutation in this dry-run.',
    schemaMigrationRequired: false,
    schemaNote:
      'Reuses content_pages.content text column with documented JSON format clone-page-v1. No migration required for structured documents.',
    cannotRepresentSafely: [
      'pracownia midCopy / partner badge (kept as static structural JSX)',
      'grupy-i-firmy introBullets / whoBullets (kept as static structural JSX)',
      'Nested dynamic archive routes (service-page/*, booking-calendar/*) remain archive fixtures',
      'Blog posts stay on clone archive path until separate blog CMS cutover',
    ],
    workshopCatalogSeparate: true,
    workshopCatalogNote:
      'Operational workshops/sessions use workshops + workshop_sessions tables — not duplicated into page JSON.',
    rollback:
      'Delete or unpublish content_pages rows by slug; public pages fall back to static fixtures automatically.',
    visualParity:
      'resolveClonePage validates JSON; invalid/missing DB content uses static registry unchanged.',
    awaitingBrunoApproval: true,
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    report.blocked = true;
    report.guards.push('Missing Supabase URL or secret key');
    writeReport(report);
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  report.target = {
    projectRef: ref,
    host: new URL(url).host,
    seedEnv: process.env.SEED_ENV || null,
  };

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { count: existingCount } = await client
    .from('content_pages')
    .select('*', { count: 'exact', head: true });

  report.existingContentPages = existingCount;

  const counts = { insert: 0, update: 0, skip: 0 };
  for (const slug of expectedSlugs) {
    const { data } = await client
      .from('content_pages')
      .select('id, slug, content')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) counts.insert += 1;
    else if (data.content && String(data.content).includes('clone-page-v1'))
      counts.skip += 1;
    else counts.update += 1;
  }
  report.expected = counts;

  if (APPLY) {
    const confirm = process.env.SEED_CONFIRM_PROJECT_REF;
    const seedEnv = (process.env.SEED_ENV || '').toLowerCase();
    if (!confirm || confirm !== ref) {
      report.blocked = true;
      report.guards.push('SEED_CONFIRM_PROJECT_REF mismatch or missing');
    }
    if (!['development', 'staging', 'production'].includes(seedEnv)) {
      report.blocked = true;
      report.guards.push('SEED_ENV required');
    }
    if (
      (seedEnv === 'production' || ref === DOCS_PRODUCTION_REF) &&
      process.env.BRUNO_CONFIRM_PRODUCTION !== '1'
    ) {
      report.blocked = true;
      report.guards.push(
        'Bruno must set BRUNO_CONFIRM_PRODUCTION=1 after reviewing this preview'
      );
    }
    report.guards.push(
      'Apply path intentionally does not write in this phase — await Bruno approval of the preview report'
    );
    report.blocked = true;
  }

  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  if (report.blocked && APPLY) process.exit(1);
}

function writeReport(report) {
  const outDir = path.join(process.cwd(), 'tmp/cms-import');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'clone-cms-import-preview.json'),
    JSON.stringify(report, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
