import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function scaffoldSupabase(db) {
  await db.exec(`
    create schema if not exists extensions;
    create extension if not exists pgcrypto with schema extensions;

    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
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

async function applyMigrations(db) {
  const files = (await readdir(migrationsDir))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${file}: ${message}`, { cause: error });
    }

    if (file === '00000000000011_cart_orders_products.sql') {
      await db.exec(`
        insert into public.workshop_categories (
          name, slug, suggested_theme, display_order
        ) values (
          'Voucher fixture', 'voucher-fixture', 'atelier', 0
        ) on conflict (slug) do nothing;

        insert into public.instructors (
          display_name, slug, is_active, display_order
        ) values (
          'Voucher fixture', 'voucher-fixture', true, 0
        ) on conflict (slug) do nothing;
      `);
    }
  }
}

async function createFixture(db) {
  const result = await db.query(`
    with category as (
      select id
      from public.workshop_categories
      where slug = 'voucher-fixture'
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
        'Voucher lifecycle workshop',
        'voucher-lifecycle-workshop',
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
    )
    select id as session_id from session
  `);
  return result.rows[0];
}

async function issueVoucher(db, { providerCode, code, valueGrosz }) {
  const result = await db.query(
    `
      select public.admin_issue_voucher(
        $1,
        $2,
        'PGlite voucher lifecycle test',
        'fixed_amount',
        $3,
        timezone('utc'::text, now()),
        timezone('utc'::text, now()) + interval '1 year',
        true,
        '{}'::text[],
        '{}'::uuid[],
        'restore'
      ) as result
    `,
    [providerCode, code, valueGrosz]
  );
  assert(result.rows[0].result.voucher_id, `Voucher ${code} was not issued`);
}

function workshopLines(sessionId) {
  return JSON.stringify([
    {
      type: 'workshop_session',
      session_id: sessionId,
      quantity: 1,
      participants: [
        {
          display_name: 'Voucher participant',
          participant_type: 'adult',
        },
      ],
    },
  ]);
}

async function submitVoucherOrder(db, fixture, suffix, code) {
  const result = await db.query(
    `
      select public.submit_cart_order_v3(
        $1,
        $2,
        'Voucher',
        'Tester',
        '500000000',
        '',
        false,
        timezone('utc'::text, now()),
        'voucher-lifecycle-test',
        $3::jsonb,
        null,
        'website',
        'stripe',
        $4
      ) as result
    `,
    [
      `voucher-lifecycle-${suffix}`,
      `voucher-${suffix}@example.invalid`,
      workshopLines(fixture.session_id),
      code,
    ]
  );
  return result.rows[0].result;
}

async function loadState(db, fixture, orderId, code) {
  const result = await db.query(
    `
      select
        o.status as order_status,
        o.payment_status,
        o.selected_payment_method,
        o.total_gross_grosz,
        o.voucher_applied_grosz,
        b.status as booking_status,
        s.reserved_count,
        v.remaining_value_grosz,
        v.status as voucher_status,
        (
          select count(*)::integer
          from public.voucher_redemptions r
          where r.order_id = o.id
        ) as redemption_count,
        (
          select r.status
          from public.voucher_redemptions r
          where r.order_id = o.id
          order by r.created_at desc
          limit 1
        ) as redemption_status,
        (
          select p.status
          from public.payments p
          where p.order_id = o.id and p.provider = 'voucher'
          order by p.created_at desc
          limit 1
        ) as voucher_payment_status,
        (
          select p.amount_gross_grosz
          from public.payments p
          where p.order_id = o.id and p.provider = 'voucher'
          order by p.created_at desc
          limit 1
        ) as voucher_payment_amount
      from public.orders o
      join public.bookings b on b.order_id = o.id
      join public.workshop_sessions s on s.id = b.workshop_session_id
      join public.gift_vouchers v
        on v.code_hash = public.voucher_code_hash($2)
      where o.id = $1 and s.id = $3
    `,
    [orderId, code, fixture.session_id]
  );
  return result.rows[0];
}

async function exerciseFullVoucher(db, fixture) {
  const code = 'PM-PGLITE-FULL-001';
  await issueVoucher(db, {
    providerCode: 'prezent_marzen',
    code,
    valueGrosz: 15000,
  });

  const created = await submitVoucherOrder(db, fixture, 'full', code);
  assert(created.voucher_fully_paid === true, 'Full voucher did not bypass cash');
  assert(created.amount_due_grosz === 0, 'Full voucher left an amount due');
  assert(created.voucher_applied_grosz === 10000, 'Full voucher amount mismatch');

  let state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'confirmed', 'Full voucher order not confirmed');
  assert(state.payment_status === 'paid', 'Full voucher payment not paid');
  assert(state.selected_payment_method === 'voucher', 'Voucher method not stored');
  assert(state.booking_status === 'confirmed', 'Full voucher booking not confirmed');
  assert(state.reserved_count === 1, 'Full voucher capacity not reserved');
  assert(state.remaining_value_grosz === 5000, 'Unused voucher balance mismatch');
  assert(state.redemption_count === 1, 'Full voucher redemption count mismatch');
  assert(state.redemption_status === 'committed', 'Full voucher not committed');
  assert(state.voucher_payment_status === 'paid', 'Voucher payment ledger not paid');
  assert(state.voucher_payment_amount === 0, 'Voucher-only cash amount was not normalized');

  const replay = await submitVoucherOrder(db, fixture, 'full', code);
  assert(replay.reused === true, 'Full voucher retry was not idempotent');
  state = await loadState(db, fixture, created.order_id, code);
  assert(
    state.redemption_count === 1 &&
      state.remaining_value_grosz === 5000 &&
      state.reserved_count === 1,
    'Full voucher retry consumed value or capacity twice'
  );

  const refunded = await db.query(
    `
      select public.refund_voucher_only_order(
        $1,
        'PGlite full voucher refund',
        'voucher-full-refund',
        null,
        'owner'
      ) as result
    `,
    [created.order_id]
  );
  assert(refunded.rows[0].result.status === 'refunded', 'Voucher refund failed');

  state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'refunded', 'Voucher order not refunded');
  assert(state.booking_status === 'refunded', 'Voucher booking not refunded');
  assert(state.reserved_count === 0, 'Voucher refund did not release capacity');
  assert(state.remaining_value_grosz === 15000, 'Voucher refund did not restore value');
  assert(state.voucher_status === 'active', 'Restored voucher is not active');
  assert(state.redemption_status === 'refunded', 'Voucher redemption not refunded');

  await db.query(
    `
      select public.refund_voucher_only_order(
        $1,
        'PGlite full voucher refund replay',
        'voucher-full-refund-replay',
        null,
        'owner'
      )
    `,
    [created.order_id]
  );
  state = await loadState(db, fixture, created.order_id, code);
  assert(
    state.remaining_value_grosz === 15000 && state.reserved_count === 0,
    'Voucher refund replay restored value or capacity twice'
  );
}

async function exercisePartialVoucher(db, fixture) {
  const code = 'CN-PGLITE-PARTIAL-001';
  await issueVoucher(db, {
    providerCode: 'ceramika_nero',
    code,
    valueGrosz: 4000,
  });

  const created = await submitVoucherOrder(db, fixture, 'partial', code);
  assert(created.voucher_fully_paid === false, 'Partial voucher became fully paid');
  assert(created.amount_due_grosz === 6000, 'Stripe remainder is incorrect');
  assert(created.voucher_applied_grosz === 4000, 'Partial voucher amount mismatch');

  let state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'awaiting_payment', 'Partial order status mismatch');
  assert(state.payment_status === 'pending', 'Partial payment status mismatch');
  assert(state.selected_payment_method === 'stripe', 'Stripe remainder method missing');
  assert(state.redemption_status === 'reserved', 'Partial voucher not reserved');
  assert(state.voucher_payment_status === 'pending', 'Voucher ledger not pending');
  assert(state.remaining_value_grosz === 0, 'Partial voucher balance not reserved');
  assert(state.reserved_count === 1, 'Partial voucher capacity not reserved');

  const replay = await submitVoucherOrder(db, fixture, 'partial', code);
  assert(replay.reused === true, 'Partial voucher retry was not idempotent');
  state = await loadState(db, fixture, created.order_id, code);
  assert(
    state.redemption_count === 1 && state.reserved_count === 1,
    'Partial voucher retry consumed value or capacity twice'
  );

  let overspendRejected = false;
  try {
    await submitVoucherOrder(db, fixture, 'partial-second', code);
  } catch (error) {
    overspendRejected = /redeemed|voucher/i.test(
      error instanceof Error ? error.message : String(error)
    );
  }
  assert(overspendRejected, 'Exhausted voucher was accepted by another order');

  const confirmed = await db.query(
    `
      select public.confirm_order_from_stripe(
        $1,
        $2,
        'evt_voucher_partial_paid',
        'cs_voucher_partial_paid',
        'pi_voucher_partial_paid',
        6000,
        'pln',
        false
      ) as result
    `,
    [created.order_id, created.payment_id]
  );
  assert(confirmed.rows[0].result.status === 'confirmed', 'Stripe remainder not confirmed');

  state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'confirmed', 'Partial order not confirmed');
  assert(state.payment_status === 'paid', 'Partial order not paid');
  assert(state.booking_status === 'confirmed', 'Partial booking not confirmed');
  assert(state.redemption_status === 'committed', 'Partial voucher not committed');
  assert(state.voucher_payment_status === 'paid', 'Voucher ledger not committed');

  const refunded = await db.query(
    `
      select public.record_order_refund_safe(
        $1,
        $2,
        6000,
        6000,
        'PGlite mixed voucher refund',
        'voucher-mixed-refund',
        null,
        'owner'
      ) as result
    `,
    [created.order_id, created.payment_id]
  );
  assert(refunded.rows[0].result.status === 'refunded', 'Mixed voucher refund failed');

  state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'refunded', 'Mixed voucher order not refunded');
  assert(state.booking_status === 'refunded', 'Mixed voucher booking not refunded');
  assert(state.reserved_count === 0, 'Mixed voucher refund did not release capacity');
  assert(state.remaining_value_grosz === 4000, 'Mixed voucher refund did not restore value');
  assert(state.voucher_status === 'active', 'Mixed restored voucher is not active');
  assert(state.redemption_status === 'refunded', 'Mixed redemption not refunded');
  assert(state.voucher_payment_status === 'refunded', 'Voucher ledger refund missing');
}

async function exerciseExpiryRestore(db, fixture) {
  const code = 'CN-PGLITE-EXPIRY-001';
  await issueVoucher(db, {
    providerCode: 'ceramika_nero',
    code,
    valueGrosz: 4000,
  });

  const created = await submitVoucherOrder(db, fixture, 'expiry', code);
  await db.query(
    `
      update public.orders
      set expires_at = timezone('utc'::text, now()) - interval '1 minute'
      where id = $1
    `,
    [created.order_id]
  );

  const expired = await db.query(
    `
      select public.expire_unpaid_order(
        $1,
        $2,
        null,
        'PGlite voucher expiry'
      ) as result
    `,
    [created.order_id, created.payment_id]
  );
  assert(expired.rows[0].result.status === 'expired', 'Voucher order did not expire');

  let state = await loadState(db, fixture, created.order_id, code);
  assert(state.order_status === 'expired', 'Expired voucher order status mismatch');
  assert(state.booking_status === 'expired', 'Expired voucher booking status mismatch');
  assert(state.reserved_count === 0, 'Expiry did not release voucher capacity');
  assert(state.remaining_value_grosz === 4000, 'Expiry did not restore voucher value');
  assert(state.voucher_status === 'active', 'Expired-order voucher is not active');
  assert(state.redemption_status === 'released', 'Expired redemption not released');
  assert(state.voucher_payment_status === 'cancelled', 'Expired voucher payment not cancelled');

  await db.query(
    `
      select public.expire_unpaid_order(
        $1,
        $2,
        null,
        'PGlite voucher expiry replay'
      )
    `,
    [created.order_id, created.payment_id]
  );
  state = await loadState(db, fixture, created.order_id, code);
  assert(
    state.remaining_value_grosz === 4000 && state.reserved_count === 0,
    'Voucher expiry replay restored value or capacity twice'
  );
}

async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.waitReady;
  await scaffoldSupabase(db);
  await applyMigrations(db);
  const fixture = await createFixture(db);

  await exerciseFullVoucher(db, fixture);
  await exercisePartialVoucher(db, fixture);
  await exerciseExpiryRestore(db, fixture);

  await db.close();
  process.stdout.write(
    'VOUCHER BEHAVIOR PASS full/partial/idempotency/overspend/refund/expiry invariants\n'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
