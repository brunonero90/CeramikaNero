import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const diagnosticPath = join(
  process.cwd(),
  'scripts',
  'audit-booking-payment-consistency.sql'
);

async function scaffoldSupabase(db) {
  await db.exec(`
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;

    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (
        select 1 from pg_roles where rolname = 'authenticated'
      ) then
        create role authenticated nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
    end
    $$;

    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key default extensions.gen_random_uuid(),
      email text
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$ select null::uuid $$;

    create schema if not exists storage;
    create table if not exists storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table if not exists storage.objects (
      id uuid primary key default extensions.gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      metadata jsonb
    );
  `);
}

async function applyMigrations(db, files) {
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
      process.stdout.write(`PASS ${file}\n`);
      if (file === '00000000000011_cart_orders_products.sql') {
        // Migration 12 is intentionally an operational-data seed and expects
        // the category/instructor seed that production already had. Supply
        // the smallest equivalent fixture so the schema path remains honest.
        await db.exec(`
          insert into public.workshop_categories (
            name,
            slug,
            suggested_theme,
            display_order
          )
          values ('Migration fixture', 'migration-fixture', 'atelier', 0)
          on conflict (slug) do nothing;

          insert into public.instructors (
            display_name,
            slug,
            is_active,
            display_order
          )
          values ('Migration fixture', 'migration-fixture', true, 0)
          on conflict (slug) do nothing;
        `);
        process.stdout.write('FIXTURE operational seed prerequisite\n');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${file}: ${message}`, { cause: error });
    }
  }
}

async function assertReleaseObjects(db) {
  const functions = await db.query(`
    select p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'bind_order_checkout_session',
        'expire_unpaid_order',
        'record_order_refund_safe',
        'sync_stripe_dispute'
      )
    order by p.proname
  `);
  const names = functions.rows.map((row) => row.proname);
  const expected = [
    'bind_order_checkout_session',
    'expire_unpaid_order',
    'record_order_refund_safe',
    'sync_stripe_dispute',
  ];
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Missing release functions: ${JSON.stringify(names)}`);
  }

  const view = await db.query(`
    select disputed_amount_grosz
    from public.analytics_payment_facts
    limit 0
  `);
  if (!Array.isArray(view.rows)) {
    throw new Error('analytics_payment_facts is unavailable');
  }
}

async function assertDiagnostic(db) {
  const sql = await readFile(diagnosticPath, 'utf8');
  await db.exec(sql);
  process.stdout.write('DIAGNOSTIC PASS read-only consistency SQL\n');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function releaseFixture(db) {
  const seeded = await db.query(`
    with category as (
      select id
      from public.workshop_categories
      where slug = 'migration-fixture'
    ),
    workshop as (
      insert into public.workshops (
        category_id,
        title,
        slug,
        default_duration_minutes,
        default_capacity,
        default_price_gross_grosz,
        currency,
        booking_mode,
        status
      )
      select
        category.id,
        'Release test workshop',
        'release-test-workshop',
        120,
        20,
        10000,
        'PLN',
        'scheduled',
        'published'
      from category
      returning id
    ),
    session as (
      insert into public.workshop_sessions (
        workshop_id,
        starts_at,
        ends_at,
        timezone,
        capacity,
        reserved_count,
        price_gross_grosz,
        currency,
        status
      )
      select
        workshop.id,
        timezone('utc'::text, now()) + interval '30 days',
        timezone('utc'::text, now()) + interval '30 days 2 hours',
        'Europe/Warsaw',
        20,
        0,
        10000,
        'PLN',
        'scheduled'
      from workshop
      returning id
    ),
    product as (
      insert into public.products (
        sku,
        slug,
        title,
        product_type,
        status,
        price_gross_grosz,
        currency,
        requires_shipping,
        allows_pickup,
        track_inventory,
        inventory_quantity,
        shipping_fee_mode
      )
      values (
        'RELEASE-TEST',
        'release-test-product',
        'Release test product',
        'physical_product',
        'published',
        5000,
        'PLN',
        false,
        true,
        true,
        20,
        'free'
      )
      returning id
    )
    select session.id as session_id, product.id as product_id
    from session cross join product
  `);
  return seeded.rows[0];
}

async function createMixedOrder(db, fixture, suffix) {
  const lines = JSON.stringify([
    {
      type: 'workshop_session',
      session_id: fixture.session_id,
      quantity: 1,
      participants: [
        {
          display_name: 'Migration participant',
          participant_type: 'adult',
        },
      ],
    },
    {
      type: 'physical_product',
      product_id: fixture.product_id,
      quantity: 2,
      fulfillment: 'pickup',
    },
  ]);

  const created = await db.query(
    `
      select public.submit_cart_order_v2(
        $1,
        $2,
        'Migration',
        'Tester',
        '500000000',
        '',
        false,
        timezone('utc'::text, now()),
        'migration-test',
        $3::jsonb,
        null,
        'website',
        'stripe'
      ) as result
    `,
    [
      `migration-release-${suffix}`,
      `migration-${suffix}@example.invalid`,
      lines,
    ]
  );
  return created.rows[0].result;
}

async function markOrderPaid(db, orderId, paymentId, paymentIntentId) {
  await db.query(
    `
      update public.payments
      set provider = 'stripe',
          status = 'paid',
          provider_payment_id = $2,
          livemode = false,
          paid_at = timezone('utc'::text, now())
      where id = $1;
    `,
    [paymentId, paymentIntentId]
  );
  await db.query(
    `
      update public.orders
      set status = 'confirmed',
          payment_status = 'paid',
          confirmed_at = timezone('utc'::text, now()),
          expires_at = null
      where id = $1;
    `,
    [orderId]
  );
  await db.query(
    `
      update public.bookings
      set status = 'confirmed',
          confirmed_at = timezone('utc'::text, now()),
          expires_at = null
      where order_id = $1;
    `,
    [orderId]
  );
}

async function exerciseReleaseRules(db) {
  const fixture = await releaseFixture(db);

  const expiring = await createMixedOrder(db, fixture, 'expiry');
  const expiryDeadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db.query(
    `
      select public.bind_order_checkout_session(
        $1,
        $2,
        'cs_release_expiry',
        $3,
        $4,
        'pln',
        false
      )
    `,
    [
      expiring.order_id,
      expiring.payment_id,
      expiryDeadline,
      expiring.total_gross_grosz,
    ]
  );
  await db.query(
    `
      update public.orders
      set expires_at = timezone('utc'::text, now()) - interval '1 minute'
      where id = $1
    `,
    [expiring.order_id]
  );
  const expired = await db.query(
    `
      select public.expire_unpaid_order(
        $1,
        $2,
        'cs_release_expiry',
        'Migration expiry test'
      ) as result
    `,
    [expiring.order_id, expiring.payment_id]
  );
  assert(expired.rows[0].result.status === 'expired', 'Order did not expire');

  const expiryState = await db.query(
    `
      select
        o.status,
        o.payment_status,
        p.inventory_quantity,
        s.reserved_count
      from public.orders o
      cross join public.products p
      cross join public.workshop_sessions s
      where o.id = $1
        and p.id = $2
        and s.id = $3
    `,
    [expiring.order_id, fixture.product_id, fixture.session_id]
  );
  assert(expiryState.rows[0].status === 'expired', 'Expired status mismatch');
  assert(
    expiryState.rows[0].payment_status === 'cancelled',
    'Expired payment status mismatch'
  );
  assert(
    expiryState.rows[0].inventory_quantity === 20,
    'Expiry did not restore inventory exactly'
  );
  assert(
    expiryState.rows[0].reserved_count === 0,
    'Expiry did not release capacity exactly'
  );

  await db.query(
    `
      select public.expire_unpaid_order(
        $1,
        $2,
        'cs_release_expiry',
        'Migration expiry replay'
      )
    `,
    [expiring.order_id, expiring.payment_id]
  );
  const replayState = await db.query(
    `
      select p.inventory_quantity, s.reserved_count
      from public.products p
      cross join public.workshop_sessions s
      where p.id = $1 and s.id = $2
    `,
    [fixture.product_id, fixture.session_id]
  );
  assert(
    replayState.rows[0].inventory_quantity === 20 &&
      replayState.rows[0].reserved_count === 0,
    'Expiry replay released resources twice'
  );

  const refundable = await createMixedOrder(db, fixture, 'refund');
  await markOrderPaid(
    db,
    refundable.order_id,
    refundable.payment_id,
    'pi_release_refund'
  );
  const fullRefund = await db.query(
    `
      select public.sync_stripe_refund(
        'pi_release_refund',
        $1,
        'pln',
        false,
        'evt_release_refund'
      ) as result
    `,
    [refundable.total_gross_grosz]
  );
  assert(
    fullRefund.rows[0].result.status === 'refunded' &&
      fullRefund.rows[0].result.requires_manual_resolution === false,
    'Full unfulfilled refund was not allocated automatically'
  );
  await db.query(
    `
      select public.sync_stripe_refund(
        'pi_release_refund',
        $1,
        'pln',
        false,
        'evt_release_refund_replay'
      )
    `,
    [refundable.total_gross_grosz]
  );
  const refundState = await db.query(
    `
      select
        o.status,
        o.fulfillment_status,
        p.inventory_quantity,
        s.reserved_count,
        (
          select count(*)::integer
          from public.order_resource_releases r
          where r.order_id = o.id
        ) as release_count
      from public.orders o
      cross join public.products p
      cross join public.workshop_sessions s
      where o.id = $1 and p.id = $2 and s.id = $3
    `,
    [refundable.order_id, fixture.product_id, fixture.session_id]
  );
  assert(refundState.rows[0].status === 'refunded', 'Refund status mismatch');
  assert(
    refundState.rows[0].fulfillment_status === 'cancelled',
    'Refund fulfillment status mismatch'
  );
  assert(
    refundState.rows[0].inventory_quantity === 20 &&
      refundState.rows[0].reserved_count === 0 &&
      refundState.rows[0].release_count === 1,
    'Full refund release was not exactly once'
  );

  const partial = await createMixedOrder(db, fixture, 'partial');
  await markOrderPaid(
    db,
    partial.order_id,
    partial.payment_id,
    'pi_release_partial'
  );
  const partialRefund = await db.query(
    `
      select public.sync_stripe_refund(
        'pi_release_partial',
        1000,
        'pln',
        false,
        'evt_release_partial'
      ) as result
    `
  );
  assert(
    partialRefund.rows[0].result.status === 'partially_refunded' &&
      partialRefund.rows[0].result.requires_manual_resolution === true,
    'Partial unified refund did not fail safe'
  );
  const partialState = await db.query(
    `
      select p.inventory_quantity, s.reserved_count
      from public.products p
      cross join public.workshop_sessions s
      where p.id = $1 and s.id = $2
    `,
    [fixture.product_id, fixture.session_id]
  );
  assert(
    partialState.rows[0].inventory_quantity === 18 &&
      partialState.rows[0].reserved_count === 1,
    'Partial refund guessed a resource allocation'
  );

  const dispute = await db.query(
    `
      select public.sync_stripe_dispute(
        'pi_release_partial',
        'dp_release',
        5000,
        'pln',
        'needs_response',
        false,
        'evt_dispute_open'
      ) as result
    `
  );
  assert(
    dispute.rows[0].result.disputed_amount_grosz === 5000,
    'Open dispute did not reduce collected revenue'
  );
  const won = await db.query(
    `
      select public.sync_stripe_dispute(
        'pi_release_partial',
        'dp_release',
        5000,
        'pln',
        'won',
        false,
        'evt_dispute_won'
      ) as result
    `
  );
  assert(
    won.rows[0].result.disputed_amount_grosz === 0,
    'Won dispute did not restore collected revenue'
  );
  const warning = await db.query(
    `
      select public.sync_stripe_dispute(
        'pi_release_partial',
        'dp_release_warning',
        2500,
        'pln',
        'warning_needs_response',
        false,
        'evt_dispute_warning'
      ) as result
    `
  );
  assert(
    warning.rows[0].result.disputed_amount_grosz === 0 &&
      warning.rows[0].result.requires_admin_action === true,
    'Warning inquiry should require action without reducing collected revenue'
  );

  process.stdout.write(
    'BEHAVIOR PASS expiry/refund/replay/partial/dispute/warning invariants\n'
  );
}

async function main() {
  const all = (await readdir(migrationsDir))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  const through19 = all.filter(
    (name) => name <= '00000000000019_payment_release_hardening.sql'
  );
  const migration20 = all.filter(
    (name) => name === '00000000000020_payment_release_go.sql'
  );

  const fresh = new PGlite({ extensions: { pgcrypto } });
  await fresh.waitReady;
  await scaffoldSupabase(fresh);
  await applyMigrations(fresh, all);
  await assertReleaseObjects(fresh);
  await exerciseReleaseRules(fresh);
  await assertDiagnostic(fresh);
  await fresh.close();
  process.stdout.write(`FRESH PASS 00→20 (${all.length} migrations)\n`);

  const upgrade = new PGlite({ extensions: { pgcrypto } });
  await upgrade.waitReady;
  await scaffoldSupabase(upgrade);
  await applyMigrations(upgrade, through19);
  await applyMigrations(upgrade, migration20);
  await assertReleaseObjects(upgrade);
  await upgrade.close();
  process.stdout.write('UPGRADE PASS 19→20\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
