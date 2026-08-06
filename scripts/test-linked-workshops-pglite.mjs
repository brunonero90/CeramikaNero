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
          'Linked fixture', 'linked-fixture', 'atelier', 0
        ) on conflict (slug) do nothing;

        insert into public.instructors (
          display_name, slug, is_active, display_order
        ) values (
          'Linked fixture', 'linked-fixture', true, 0
        ) on conflict (slug) do nothing;
      `);
    }
  }
}

async function createLinkedFixture(db) {
  const result = await db.query(`
    with category as (
      select id from public.workshop_categories where slug = 'linked-fixture'
    ),
    followup as (
      insert into public.workshops (
        category_id, title, slug, minimum_age, default_duration_minutes,
        default_capacity, default_price_gross_grosz, currency, booking_mode,
        status, participant_audience, collect_participant_age, workshop_type
      )
      select category.id, 'Szkliwienie testowe', 'szkliwienie-testowe', 18,
        90, 10, 5000, 'PLN', 'scheduled', 'published', 'adult', false,
        'szkliwienie'
      from category
      returning id
    ),
    primary_workshop as (
      insert into public.workshops (
        category_id, title, slug, minimum_age, default_duration_minutes,
        default_capacity, default_price_gross_grosz, currency, booking_mode,
        status, participant_audience, collect_participant_age, workshop_type,
        requires_followup_session, followup_workshop_id,
        followup_workshop_type, followup_min_days, followup_max_days
      )
      select category.id, 'Glina do Wina test', 'glina-do-wina-test', 18,
        120, 10, 10000, 'PLN', 'scheduled', 'published', 'adult', false,
        'glina-do-wina', true, followup.id, 'szkliwienie', 5, 45
      from category cross join followup
      returning id
    ),
    primary_session as (
      insert into public.workshop_sessions (
        workshop_id, starts_at, ends_at, timezone, capacity, reserved_count,
        price_gross_grosz, currency, status
      )
      select primary_workshop.id, timezone('utc'::text, now()) + interval '30 days',
        timezone('utc'::text, now()) + interval '30 days 2 hours',
        'Europe/Warsaw', 10, 0, 10000, 'PLN', 'scheduled'
      from primary_workshop
      returning id
    ),
    followup_session as (
      insert into public.workshop_sessions (
        workshop_id, starts_at, ends_at, timezone, capacity, reserved_count,
        price_gross_grosz, currency, status
      )
      select followup.id, timezone('utc'::text, now()) + interval '40 days',
        timezone('utc'::text, now()) + interval '40 days 90 minutes',
        'Europe/Warsaw', 10, 0, 5000, 'PLN', 'scheduled'
      from followup
      returning id
    )
    select
      primary_workshop.id as primary_workshop_id,
      followup.id as followup_workshop_id,
      primary_session.id as primary_session_id,
      followup_session.id as followup_session_id
    from primary_workshop
    cross join followup
    cross join primary_session
    cross join followup_session
  `);
  return result.rows[0];
}

function primaryOnlyLines(primarySessionId) {
  return JSON.stringify([
    {
      type: 'workshop_session',
      session_id: primarySessionId,
      quantity: 1,
      participants: [
        {
          display_name: 'Bruno Nero',
          age: null,
          participant_type: 'adult',
          accessibility_notes: null,
        },
      ],
    },
  ]);
}

function linkedLines(primarySessionId, followupSessionId) {
  const participant = {
    display_name: 'Bruno Nero',
    age: null,
    participant_type: 'adult',
    accessibility_notes: null,
  };
  const groupKey = `${primarySessionId}:${followupSessionId}`;
  return JSON.stringify([
    {
      type: 'workshop_session',
      session_id: primarySessionId,
      quantity: 1,
      link_role: 'primary',
      link_group_key: groupKey,
      participants: [participant],
    },
    {
      type: 'workshop_session',
      session_id: followupSessionId,
      quantity: 1,
      link_role: 'followup',
      linked_primary_session_id: primarySessionId,
      link_group_key: groupKey,
      participants: [participant],
    },
  ]);
}

async function exerciseLinkedCheckout(db) {
  const fixture = await createLinkedFixture(db);
  const idempotencyKey = 'linked-workshops-pglite-checkout';
  const lines = linkedLines(
    fixture.primary_session_id,
    fixture.followup_session_id
  );

  const first = await db.query(
    `select public.submit_cart_order_v5(
      $1, $2, $3, $4, $5, $6, false,
      timezone('utc'::text, now()), 'test', $7::jsonb,
      null, 'website', 'stripe', null
    ) as result`,
    [
      idempotencyKey,
      'linked@example.com',
      'Bruno',
      'Nero',
      '500600700',
      '',
      lines,
    ]
  );
  const firstResult = first.rows[0].result;
  const orderId = firstResult.order_id;
  assert(orderId, 'Linked checkout did not return an order');
  assert(
    firstResult.total_gross_grosz === 15000,
    'Both stages were not priced'
  );
  assert(firstResult.booking_references.length === 2, 'Expected two bookings');

  const state = await db.query(
    `select
      (select count(*)::int from public.bookings where order_id = $1) as booking_count,
      (select count(*)::int from public.booking_links where order_id = $1) as link_count,
      (select count(*)::int
       from public.booking_participants bp
       join public.bookings b on b.id = bp.booking_id
       where b.order_id = $1 and bp.age is null and bp.participant_type = 'adult') as adult_without_age,
      (select reserved_count from public.workshop_sessions where id = $2) as primary_reserved,
      (select reserved_count from public.workshop_sessions where id = $3) as followup_reserved`,
    [orderId, fixture.primary_session_id, fixture.followup_session_id]
  );
  const row = state.rows[0];
  assert(
    row.booking_count === 2,
    'Linked checkout did not create two bookings'
  );
  assert(
    row.link_count === 1,
    'Linked checkout did not persist one booking link'
  );
  assert(row.adult_without_age === 2, 'Adult ages were persisted unexpectedly');
  assert(row.primary_reserved === 1, 'Primary capacity was not reserved');
  assert(row.followup_reserved === 1, 'Follow-up capacity was not reserved');

  const replay = await db.query(
    `select public.submit_cart_order_v5(
      $1, $2, $3, $4, $5, $6, false,
      timezone('utc'::text, now()), 'test', $7::jsonb,
      null, 'website', 'stripe', null
    ) as result`,
    [
      idempotencyKey,
      'linked@example.com',
      'Bruno',
      'Nero',
      '500600700',
      '',
      lines,
    ]
  );
  assert(
    replay.rows[0].result.reused === true,
    'Checkout replay was not reused'
  );

  const replayState = await db.query(
    `select
      (select count(*)::int from public.bookings where order_id = $1) as booking_count,
      (select count(*)::int from public.booking_links where order_id = $1) as link_count,
      (select reserved_count from public.workshop_sessions where id = $2) as primary_reserved,
      (select reserved_count from public.workshop_sessions where id = $3) as followup_reserved`,
    [orderId, fixture.primary_session_id, fixture.followup_session_id]
  );
  assert(replayState.rows[0].booking_count === 2, 'Replay duplicated bookings');
  assert(
    replayState.rows[0].link_count === 1,
    'Replay duplicated booking links'
  );
  assert(
    replayState.rows[0].primary_reserved === 1,
    'Replay doubled primary capacity'
  );
  assert(
    replayState.rows[0].followup_reserved === 1,
    'Replay doubled follow-up capacity'
  );

  const bookings = await db.query(
    `select id from public.bookings where order_id = $1 order by created_at asc`,
    [orderId]
  );
  await db.query(
    `select public.cancel_booking($1, 'customer', 'integration test', null, null)`,
    [bookings.rows[0].id]
  );

  const cancelled = await db.query(
    `select
      (select count(*)::int from public.bookings
       where order_id = $1 and status = 'cancelled') as cancelled_count,
      (select reserved_count from public.workshop_sessions where id = $2) as primary_reserved,
      (select reserved_count from public.workshop_sessions where id = $3) as followup_reserved`,
    [orderId, fixture.primary_session_id, fixture.followup_session_id]
  );
  assert(
    cancelled.rows[0].cancelled_count === 2,
    'Linked cancellation missed a stage'
  );
  assert(
    cancelled.rows[0].primary_reserved === 0,
    'Primary capacity was not released'
  );
  assert(
    cancelled.rows[0].followup_reserved === 0,
    'Follow-up capacity was not released'
  );

  await db.query(
    `insert into public.booking_events (
       booking_id, event_type, actor_type, metadata
     ) values ($1, 'attendance_updated', 'system', '{}'::jsonb)`,
    [bookings.rows[0].id]
  );

  let selfLinkRejected = false;
  try {
    await db.query(
      `update public.workshops
       set followup_workshop_id = id
       where id = $1`,
      [fixture.primary_workshop_id]
    );
  } catch (error) {
    selfLinkRejected = String(error).includes(
      'workshops_followup_not_self_check'
    );
  }
  assert(selfLinkRejected, 'A workshop was allowed to follow itself');

  await db.query(
    `update public.workshop_sessions
     set reserved_count = capacity
     where id = $1`,
    [fixture.followup_session_id]
  );
  let unavailableRejected = false;
  try {
    await db.query(
      `select public.submit_cart_order_v5(
        $1, $2, $3, $4, $5, $6, false,
        timezone('utc'::text, now()), 'test', $7::jsonb,
        null, 'website', 'stripe', null
      ) as result`,
      [
        'linked-workshops-unavailable-followup',
        'unavailable@example.com',
        'Bruno',
        'Nero',
        '500600700',
        '',
        lines,
      ]
    );
  } catch (error) {
    unavailableRejected = String(error)
      .toLowerCase()
      .includes('follow-up session is no longer available');
  }
  assert(
    unavailableRejected,
    'Full follow-up capacity did not produce the dedicated error'
  );
  await db.query(
    `update public.workshop_sessions set reserved_count = 0 where id = $1`,
    [fixture.followup_session_id]
  );

  await db.query(
    `update public.workshops
     set offers_followup_session = true, requires_followup_session = false
     where id = $1`,
    [fixture.primary_workshop_id]
  );
  const optional = await db.query(
    `select public.submit_cart_order_v5(
      $1, $2, $3, $4, $5, $6, false,
      timezone('utc'::text, now()), 'test', $7::jsonb,
      null, 'website', 'stripe', null
    ) as result`,
    [
      'linked-workshops-optional-skip',
      'optional@example.com',
      'Bruno',
      'Nero',
      '500600700',
      '',
      primaryOnlyLines(fixture.primary_session_id),
    ]
  );
  assert(
    optional.rows[0].result.booking_references.length === 1,
    'Optional follow-up could not be skipped'
  );
  assert(
    optional.rows[0].result.total_gross_grosz === 10000,
    'Skipped optional follow-up changed the primary price'
  );
}

async function createReminderBooking(
  db,
  provider,
  email,
  status = 'confirmed'
) {
  const result = await db.query(
    `with category as (
      select id from public.workshop_categories where slug = 'linked-fixture'
    ), workshop as (
      insert into public.workshops (
        category_id, title, slug, default_duration_minutes, default_capacity,
        default_price_gross_grosz, currency, booking_mode, status,
        participant_audience, collect_participant_age, workshop_type
      )
      select category.id,
        'Reminder ' || $1,
        'reminder-' || $1,
        60, 10, 1000, 'PLN', 'scheduled', 'published',
        'adult', false, 'reminder'
      from category
      returning id
    ), session as (
      insert into public.workshop_sessions (
        workshop_id, starts_at, ends_at, timezone, capacity, reserved_count,
        price_gross_grosz, currency, status
      )
      select workshop.id,
        timezone('utc'::text, now()) + interval '24 hours',
        timezone('utc'::text, now()) + interval '25 hours',
        'Europe/Warsaw', 10, case when $4 = 'confirmed' then 1 else 0 end,
        1000, 'PLN', 'scheduled'
      from workshop
      returning id
    ), customer as (
      insert into public.customer_profiles (
        email, first_name, last_name, phone, marketing_consent,
        privacy_policy_version
      ) values ($2, 'Test', 'Reminder', '500600700', false, 'test')
      returning id
    ), booking as (
      insert into public.bookings (
        customer_id, workshop_session_id, status, quantity,
        unit_price_gross_grosz, total_price_gross_grosz, currency,
        source, terms_accepted_at, privacy_policy_version, confirmed_at
      )
      select customer.id, session.id, $4, 1, 1000, 1000, 'PLN',
        'admin', timezone('utc'::text, now()), 'test',
        case when $4 = 'confirmed' then timezone('utc'::text, now()) else null end
      from customer cross join session
      returning id
    )
    insert into public.payments (
      booking_id, provider, status, amount_gross_grosz, currency,
      idempotency_key, paid_at
    )
    select booking.id, $3, 'paid', 1000, 'PLN',
      'reminder-' || $1,
      timezone('utc'::text, now())
    from booking
    returning booking_id`,
    [provider.replaceAll('_', '-'), email, provider, status]
  );
  return result.rows[0].booking_id;
}

async function exerciseReminders(db) {
  const stripeBooking = await createReminderBooking(
    db,
    'stripe',
    'stripe-reminder@example.com'
  );
  const manualBooking = await createReminderBooking(
    db,
    'bank_transfer',
    'manual-reminder@example.com'
  );
  const cancelledBooking = await createReminderBooking(
    db,
    'cash',
    'cancelled-reminder@example.com',
    'cancelled'
  );

  const first = await db.query(
    `select public.enqueue_booking_reminders(null, null) as result`
  );
  assert(
    first.rows[0].result.queued === 2,
    'Stripe/manual reminders were not queued'
  );

  const second = await db.query(
    `select public.enqueue_booking_reminders(null, null) as result`
  );
  assert(
    second.rows[0].result.queued === 0,
    'Reminder rerun queued duplicates'
  );

  const counts = await db.query(
    `select
      (select count(*)::int from public.booking_emails
       where booking_id in ($1, $2) and email_type = 'reminder') as eligible_count,
      (select count(*)::int from public.booking_emails
       where booking_id = $3 and email_type = 'reminder') as cancelled_count`,
    [stripeBooking, manualBooking, cancelledBooking]
  );
  assert(
    counts.rows[0].eligible_count === 2,
    'Expected one reminder per eligible booking'
  );
  assert(
    counts.rows[0].cancelled_count === 0,
    'Cancelled booking received a reminder'
  );

  await db.query(
    `select public.cancel_booking($1, 'staff', 'cancel before reminder', null, null)`,
    [stripeBooking]
  );
  const cleanup = await db.query(
    `select public.enqueue_booking_reminders(null, null) as result`
  );
  assert(
    cleanup.rows[0].result.skipped >= 1,
    'Cancelled queued reminder was not skipped'
  );

  const cancelledRow = await db.query(
    `select status, error_message from public.booking_emails
     where booking_id = $1 and email_type = 'reminder'`,
    [stripeBooking]
  );
  assert(
    cancelledRow.rows[0].status === 'failed',
    'Cancelled reminder stayed dispatchable'
  );
  assert(
    String(cancelledRow.rows[0].error_message).includes('permanent'),
    'Cancelled reminder was not permanently closed'
  );

  const repeatedCleanup = await db.query(
    `select public.enqueue_booking_reminders(null, null) as result`
  );
  assert(
    repeatedCleanup.rows[0].result.skipped === 0,
    'Permanent reminder skip was logged more than once'
  );
  const skipEvents = await db.query(
    `select count(*)::int as count
     from public.booking_events
     where booking_id = $1 and event_type = 'reminder_skipped'`,
    [stripeBooking]
  );
  assert(
    skipEvents.rows[0].count === 1,
    'Expected exactly one reminder_skipped audit event'
  );
}

async function main() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await scaffoldSupabase(db);
    await applyMigrations(db);
    await exerciseLinkedCheckout(db);
    await exerciseReminders(db);
    console.log(
      'LINKED WORKSHOPS PASS adult-name/optional-followup/atomic-capacity/idempotency/cancellation/reminder invariants'
    );
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
