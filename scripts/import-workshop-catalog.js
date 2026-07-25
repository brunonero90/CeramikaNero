'use strict';

/**
 * Import workshop catalog + recurring sessions into Supabase.
 *
 * Prices/cadences come from archive homepage cards + workshop-catalog-import.ts
 * (documented provenance). Enquiry offers are published without sessions.
 *
 * Usage:
 *   node scripts/import-workshop-catalog.js
 *   node scripts/import-workshop-catalog.js --apply
 *
 * Required for --apply:
 *   SEED_CONFIRM_PROJECT_REF=zorxzyvmcbwucvaywmuu
 *   SEED_ENV=production
 *   BRUNO_CONFIRM_PRODUCTION=1
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

const APPLY = process.argv.includes('--apply');
const PROJECT_REF = 'zorxzyvmcbwucvaywmuu';

const CATEGORIES = [
  {
    name: 'Dla dzieci',
    slug: 'dla-dzieci',
    description: 'Warsztaty ceramiczne dla najmłodszych artystów.',
    suggested_theme: 'joyful',
    display_order: 10,
  },
  {
    name: 'Dla dorosłych',
    slug: 'dla-doroslych',
    description: 'Warsztaty i kursy ceramiczne dla dorosłych.',
    suggested_theme: 'atelier',
    display_order: 20,
  },
  {
    name: 'Rodzinne',
    slug: 'rodzinne',
    description: 'Wspólne tworzenie dla rodziców i dzieci.',
    suggested_theme: 'joyful',
    display_order: 30,
  },
  {
    name: 'Glina do wina',
    slug: 'glina-do-wina',
    description: 'Wieczorne warsztaty ceramiczne z lampką wina.',
    suggested_theme: 'atelier',
    display_order: 40,
  },
  {
    name: 'Urodziny',
    slug: 'urodziny',
    description: 'Urodzinowe warsztaty ceramiczne dla dzieci i dorosłych.',
    suggested_theme: 'joyful',
    display_order: 50,
  },
  {
    name: 'Grupy i firmy',
    slug: 'grupy-i-firmy',
    description: 'Warsztaty integracyjne dla grup i firm.',
    suggested_theme: 'atelier',
    display_order: 60,
  },
  {
    name: 'Wieczory panieńskie',
    slug: 'wieczory-panienskie',
    description: 'Kreatywne spotkania dla przyszłej panny młodej i gości.',
    suggested_theme: 'joyful',
    display_order: 70,
  },
  {
    name: 'Półkolonie i wydarzenia',
    slug: 'polkolonie-i-wydarzenia',
    description: 'Półkolonie oraz sezonowe wydarzenia ceramiczne.',
    suggested_theme: 'joyful',
    display_order: 80,
  },
];

/** Archive-proven / catalog prices (grosz). Youth uses seed.sql provisional 140 zł. */
const WORKSHOPS = [
  {
    slug: 'ceramika-dla-doroslych',
    title: 'Ceramika dla dorosłych',
    categorySlug: 'dla-doroslych',
    shortDescription:
      'Wieczorne i weekendowe warsztaty ceramiczne dla dorosłych.',
    description:
      'Warsztaty obejmują podstawowe techniki pracy z gliną. Oferta zgodna z archiwalnymi kartami rezerwacji i stroną Dla dorosłych.',
    practicalInformation:
      'Materiały i narzędzia w cenie. Pracownia: ul. Podgórna 3, Suchy Las.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: true,
    price: 14900,
    capacity: 12,
    duration: 90,
    minAge: 18,
    maxAge: null,
    theme: 'atelier',
    cadence: { weekdays: [1, 4], hour: 18, minute: 30, label: 'pon/czw 18:30' },
  },
  {
    slug: 'glina-do-wina',
    title: 'Glina do wina',
    categorySlug: 'glina-do-wina',
    shortDescription: 'Wieczór z gliną i kieliszkiem wina dla dorosłych.',
    description:
      'Warsztaty Glina do wina — lepienie, szkliwienie, włoska atmosfera. Treść zgodna z /glinadowina i kartami usług.',
    practicalInformation:
      'Warsztat 18+. Wino i przekąski w cenie (wariant Suchy Las). ul. Podgórna 3.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: true,
    price: 18900,
    capacity: 14,
    duration: 120,
    minAge: 18,
    maxAge: null,
    theme: 'atelier',
    cadence: { weekdays: [5], hour: 19, minute: 0, label: 'pt 19:00' },
  },
  {
    slug: 'glina-do-wina-w-poznaniu-w-ptasim-radiu',
    title: 'Glina do wina w Poznaniu w Ptasim Radiu',
    categorySlug: 'glina-do-wina',
    shortDescription:
      'Warsztaty ceramiczne w kawiarni Ptasie Radio w Poznaniu.',
    description:
      'Oferta archiwalna „GLINA DO WINA W POZNANIU W PTASIM RADIU”. Osobna lokalizacja od wariantu Suchy Las.',
    practicalInformation:
      'Ptasie Radio, ul. Kościuszki 74/3, 60-142 Poznań. 90 min. Sesje z archiwum — nie generować automatycznej rekurencji poza zweryfikowanymi datami.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: true,
    price: 18900,
    capacity: 12,
    duration: 90,
    minAge: 18,
    maxAge: null,
    theme: 'atelier',
    // Sessions are seeded by migration 12 from archive evidence only.
    cadence: null,
    venueKey: 'ptasie-radio',
    locationName: 'Ptasie Radio',
    locationAddress: 'ul. Kościuszki 74/3, 60-142 Poznań',
  },
  {
    slug: 'glina-i-rodzina',
    title: 'Glina i rodzina',
    categorySlug: 'rodzinne',
    shortDescription: 'Sobotnie warsztaty rodzinne z gliną.',
    description:
      'Oferta z karty homepage „GLINA I RODZINA SOBOTY 15.00” (95 zł).',
    practicalInformation:
      'Warsztaty rodzinne. Materiały w cenie. ul. Podgórna 3, Suchy Las.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: true,
    price: 9500,
    capacity: 12,
    duration: 60,
    minAge: 4,
    maxAge: null,
    theme: 'joyful',
    cadence: { weekdays: [6], hour: 15, minute: 0, label: 'sob 15:00' },
  },
  {
    slug: 'kurs-rysunku-malarstwa-ceramiki-6-10-lat',
    title: 'Kurs rysunku, malarstwa i ceramiki 6–10 lat',
    categorySlug: 'dla-dzieci',
    shortDescription: 'Kreatywny kurs dla dzieci w wieku 6–10 lat.',
    description:
      'Kurs łączący rysunek, malarstwo i ceramikę — oferta z archiwum /dla-dzieci.',
    practicalInformation: 'Materiały w cenie. Zajęcia w małej grupie.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: false,
    price: 10900,
    capacity: 10,
    duration: 120,
    minAge: 6,
    maxAge: 10,
    theme: 'joyful',
    cadence: { weekdays: [3], hour: 10, minute: 0, label: 'śr 10:00' },
  },
  {
    slug: 'kurs-ceramiki-dla-mlodziezy-11',
    title: 'Kurs ceramiki dla młodzieży 11+',
    categorySlug: 'dla-dzieci',
    shortDescription: 'Kurs ceramiczny dla młodzieży 11+.',
    description: 'Oferta z archiwum strony Dla dzieci (grupa 11+).',
    practicalInformation: 'Materiały w cenie. Zajęcia w małej grupie.',
    bookingMode: 'scheduled',
    status: 'published',
    isFeatured: false,
    // Archive catalog had 0; seed.sql provisional 140 zł used so booking can publish.
    price: 14000,
    capacity: 10,
    duration: 120,
    minAge: 11,
    maxAge: null,
    theme: 'joyful',
    cadence: { weekdays: [2], hour: 17, minute: 0, label: 'wt 17:00' },
  },
  {
    slug: 'urodziny-ceramiczne',
    title: 'Urodziny ceramiczne',
    categorySlug: 'urodziny',
    shortDescription: 'Urodziny z ceramiką — oferta pakietowa.',
    description:
      'Pakiety urodzinowe z archiwum /urodziny. Rezerwacja przez kontakt.',
    practicalInformation:
      'Wycena indywidualna — napisz przez formularz kontaktowy.',
    bookingMode: 'enquiry',
    status: 'published',
    isFeatured: true,
    price: 0,
    capacity: 10,
    duration: 120,
    minAge: 4,
    maxAge: null,
    theme: 'joyful',
    cadence: null,
  },
  {
    slug: 'warsztaty-dla-firm',
    title: 'Warsztaty dla firm',
    categorySlug: 'grupy-i-firmy',
    shortDescription: 'Warsztaty integracyjne dla grup i firm.',
    description: 'Oferta z /grupy-i-firmy — wycena indywidualna.',
    practicalInformation: 'Wycena indywidualna — kontakt.',
    bookingMode: 'enquiry',
    status: 'published',
    isFeatured: false,
    price: 0,
    capacity: 15,
    duration: 150,
    minAge: 18,
    maxAge: null,
    theme: 'atelier',
    cadence: null,
  },
  {
    slug: 'wieczory-panienskie',
    title: 'Wieczory panieńskie',
    categorySlug: 'wieczory-panienskie',
    shortDescription: 'Pakiety panieńskie STANDARD / PLUS / VIP.',
    description: 'Oferta z /panienskie. Rezerwacja przez kontakt.',
    practicalInformation: 'Pakiety od 5 do 15 osób — wycena przez kontakt.',
    bookingMode: 'enquiry',
    status: 'published',
    isFeatured: true,
    price: 0,
    capacity: 15,
    duration: 180,
    minAge: 18,
    maxAge: null,
    theme: 'joyful',
    cadence: null,
  },
];

const LOCATION = {
  name: 'Pracownia Ceramika Nero',
  address: 'ul. Podgórna 3, 62-002 Suchy Las',
};

const WEEKS_AHEAD = 6;

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Build Europe/Warsaw local wall times as UTC ISO via format trick. */
function warsawLocalToUtcIso(year, monthIndex, day, hour, minute) {
  const pad = (n) => String(n).padStart(2, '0');
  const asUtcGuess = new Date(Date.UTC(year, monthIndex, day, hour, minute, 0));
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(asUtcGuess).map((p) => [p.type, p.value])
  );
  const asWarsaw = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  const offset = asWarsaw - asUtcGuess.getTime();
  return new Date(asUtcGuess.getTime() - offset).toISOString();
}

function enumerateCadenceSessions(cadence, durationMinutes, fromDate, weeks) {
  const out = [];
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const weekday = d.getDay(); // 0 Sun … 6 Sat (local machine — use Warsaw)
    // Recompute weekday in Warsaw
    const warsawWeekday = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Warsaw',
        weekday: 'short',
      })
        .formatToParts(d)
        .find((p) => p.type === 'weekday')?.value
        ? // map via date in Warsaw parts
          null
        : null
    );
    void warsawWeekday;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = wdMap[map.weekday];
    if (!cadence.weekdays.includes(wd)) continue;

    const y = Number(map.year);
    const m = Number(map.month) - 1;
    const day = Number(map.day);
    const startsAt = warsawLocalToUtcIso(
      y,
      m,
      day,
      cadence.hour,
      cadence.minute
    );
    if (new Date(startsAt).getTime() <= Date.now()) continue;
    const endsAt = new Date(
      new Date(startsAt).getTime() + durationMinutes * 60_000
    ).toISOString();
    out.push({ startsAt, endsAt });
  }
  return out;
}

async function ensureCategories(client, dryRun) {
  const idBySlug = {};
  for (const cat of CATEGORIES) {
    const { data: existing, error } = await client
      .from('workshop_categories')
      .select('id, slug')
      .eq('slug', cat.slug)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      idBySlug[cat.slug] = existing.id;
      continue;
    }
    if (dryRun) {
      idBySlug[cat.slug] = `dry-${cat.slug}`;
      continue;
    }
    const { data, error: insErr } = await client
      .from('workshop_categories')
      .insert({
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        suggested_theme: cat.suggested_theme,
        display_order: cat.display_order,
        is_visible: true,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;
    idBySlug[cat.slug] = data.id;
  }
  return idBySlug;
}

async function ensureInstructor(client, dryRun) {
  const slug = 'malgorzata-nero';
  const { data: existing, error } = await client
    .from('instructors')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.id;
  if (dryRun) return 'dry-instructor';
  const { data, error: insErr } = await client
    .from('instructors')
    .insert({
      display_name: 'Małgorzata Nero',
      slug,
      biography:
        'Właścicielka Pracowni ceramiki Nero. Kontakt publiczny z archiwum strony.',
      is_active: true,
      display_order: 10,
    })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return data.id;
}

async function upsertWorkshop(client, dryRun, workshop, categoryId) {
  const payload = {
    category_id: categoryId,
    title: workshop.title,
    slug: workshop.slug,
    short_description: workshop.shortDescription,
    description: workshop.description,
    practical_information: workshop.practicalInformation,
    minimum_age: workshop.minAge,
    maximum_age: workshop.maxAge,
    default_duration_minutes: workshop.duration,
    default_capacity: workshop.capacity,
    default_price_gross_grosz: workshop.price,
    booking_mode: workshop.bookingMode,
    status: workshop.status,
    is_featured: workshop.isFeatured,
    suggested_theme: workshop.theme,
    seo_title: `${workshop.title} | Ceramika Nero`,
    seo_description: workshop.shortDescription,
    archived_at: null,
  };

  const { data: existing, error } = await client
    .from('workshops')
    .select('id, slug')
    .eq('slug', workshop.slug)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    if (dryRun) return existing.id;
    const { error: updErr } = await client
      .from('workshops')
      .update(payload)
      .eq('id', existing.id);
    if (updErr) throw updErr;
    return existing.id;
  }

  if (dryRun) return `dry-${workshop.slug}`;
  const { data, error: insErr } = await client
    .from('workshops')
    .insert(payload)
    .select('id')
    .single();
  if (insErr) throw insErr;
  return data.id;
}

async function ensureSessions(
  client,
  dryRun,
  workshop,
  workshopId,
  instructorId
) {
  if (!workshop.cadence || workshop.bookingMode !== 'scheduled') {
    return { created: 0, skipped: 0, planned: 0 };
  }
  const slots = enumerateCadenceSessions(
    workshop.cadence,
    workshop.duration,
    new Date(),
    WEEKS_AHEAD
  );
  let created = 0;
  let skipped = 0;

  if (dryRun) {
    return { created: slots.length, skipped: 0, planned: slots.length };
  }

  for (const slot of slots) {
    const { data: existing, error } = await client
      .from('workshop_sessions')
      .select('id')
      .eq('workshop_id', workshopId)
      .eq('starts_at', slot.startsAt)
      .maybeSingle();
    if (error) throw error;
    if (existing) {
      skipped += 1;
      continue;
    }
    const { error: insErr } = await client.from('workshop_sessions').insert({
      workshop_id: workshopId,
      instructor_id: instructorId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      timezone: 'Europe/Warsaw',
      capacity: workshop.capacity,
      reserved_count: 0,
      price_gross_grosz: workshop.price,
      currency: 'PLN',
      location_name: LOCATION.name,
      location_address: LOCATION.address,
      status: 'scheduled',
    });
    if (insErr) throw insErr;
    created += 1;
  }
  return { created, skipped, planned: slots.length };
}

async function archiveSmoke(client, dryRun) {
  const { data: smoke, error } = await client
    .from('workshops')
    .select('id, slug')
    .eq('slug', 'smoke-test-ceramika-dla-doroslych')
    .maybeSingle();
  if (error) throw error;
  if (!smoke) return { archived: false };
  if (dryRun) return { archived: true, dryRun: true };
  const { error: updErr } = await client
    .from('workshops')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', smoke.id);
  if (updErr) throw updErr;
  await client
    .from('workshop_sessions')
    .update({ status: 'cancelled' })
    .eq('workshop_id', smoke.id)
    .neq('status', 'cancelled');
  return { archived: true };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    blocked: false,
    guards: [],
    workshops: [],
    sessions: {},
    smoke: null,
  };

  if (!url || !secret) {
    report.blocked = true;
    report.guards.push('Missing Supabase env');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const ref = projectRefFromUrl(url);
  report.target = { projectRef: ref, host: new URL(url).host };

  if (APPLY) {
    if (process.env.SEED_CONFIRM_PROJECT_REF !== ref) {
      report.blocked = true;
      report.guards.push('SEED_CONFIRM_PROJECT_REF mismatch');
    }
    if (process.env.SEED_ENV !== 'production') {
      report.blocked = true;
      report.guards.push('SEED_ENV must be production for this import');
    }
    if (process.env.BRUNO_CONFIRM_PRODUCTION !== '1') {
      report.blocked = true;
      report.guards.push('BRUNO_CONFIRM_PRODUCTION=1 required');
    }
    if (ref !== PROJECT_REF) {
      report.blocked = true;
      report.guards.push(`Expected project ${PROJECT_REF}`);
    }
  }

  if (report.blocked) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const dryRun = !APPLY;
  const categories = await ensureCategories(client, dryRun);
  const instructorId = await ensureInstructor(client, dryRun);

  for (const workshop of WORKSHOPS) {
    const categoryId = categories[workshop.categorySlug];
    if (!categoryId)
      throw new Error(`Missing category ${workshop.categorySlug}`);
    const workshopId = await upsertWorkshop(
      client,
      dryRun,
      workshop,
      categoryId
    );
    const sessionStats = await ensureSessions(
      client,
      dryRun,
      workshop,
      workshopId,
      instructorId
    );
    report.workshops.push({
      slug: workshop.slug,
      workshopId,
      bookingMode: workshop.bookingMode,
      status: workshop.status,
      price: workshop.price,
      sessions: sessionStats,
    });
  }

  report.smoke = await archiveSmoke(client, dryRun);

  const outDir = path.join(process.cwd(), 'tmp/overnight-completion');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'catalog-import-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
