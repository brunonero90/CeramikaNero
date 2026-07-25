-- Ceramika Nero — unified cart: products, orders, venue keys, mixed checkout RPC.
-- Additive and backward-compatible. Does not alter existing booking rows.

-- ---------------------------------------------------------------------------
-- Venue identity on sessions (filtering must not use title substrings)
-- ---------------------------------------------------------------------------

alter table public.workshop_sessions
  add column if not exists venue_key text;

alter table public.workshop_sessions
  drop constraint if exists workshop_sessions_venue_key_check;

alter table public.workshop_sessions
  add constraint workshop_sessions_venue_key_check
  check (venue_key is null or venue_key in ('suchy-las', 'ptasie-radio', 'other'));

comment on column public.workshop_sessions.venue_key is
  'Normalized venue key for filtering: suchy-las, ptasie-radio, other.';

update public.workshop_sessions
set venue_key = 'suchy-las'
where venue_key is null
  and (
    location_address ilike '%Suchy Las%'
    or location_name ilike '%Ceramika Nero%'
    or location_name ilike '%Pracownia%'
  );

create index if not exists idx_workshop_sessions_venue_key
  on public.workshop_sessions (venue_key)
  where venue_key is not null;

-- ---------------------------------------------------------------------------
-- Products (Glina Box + studio firing/glazing)
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  slug text not null unique,
  title text not null,
  short_description text,
  description text,
  product_type text not null check (product_type in ('physical_product', 'studio_service')),
  status text not null check (status in ('draft', 'published', 'archived')),
  price_gross_grosz integer not null check (price_gross_grosz >= 0),
  compare_at_price_gross_grosz integer check (
    compare_at_price_gross_grosz is null or compare_at_price_gross_grosz >= 0
  ),
  currency text not null default 'PLN' check (currency = 'PLN'),
  images jsonb not null default '[]'::jsonb,
  requires_shipping boolean not null default false,
  allows_pickup boolean not null default true,
  track_inventory boolean not null default false,
  inventory_quantity integer not null default 0 check (inventory_quantity >= 0),
  shipping_fee_mode text not null default 'quote_required'
    check (shipping_fee_mode in ('quote_required', 'fixed', 'free')),
  shipping_fee_gross_grosz integer check (
    shipping_fee_gross_grosz is null or shipping_fee_gross_grosz >= 0
  ),
  seo_title text,
  seo_description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz
);

comment on table public.products is
  'Physical products and studio services sold via the unified cart (Glina Box, firing).';

create index if not exists idx_products_status on public.products (status, archived_at);
create index if not exists idx_products_type on public.products (product_type);

alter table public.products enable row level security;

drop policy if exists "Public can view published products" on public.products;
create policy "Public can view published products"
  on public.products for select
  to anon, authenticated
  using (status = 'published' and archived_at is null);

drop policy if exists "Managers and owners can manage products" on public.products;
create policy "Managers and owners can manage products"
  on public.products for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage products" on public.products;
create policy "Service role can manage products"
  on public.products for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Orders aggregate
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique,
  idempotency_key text,
  customer_id uuid not null references public.customer_profiles(id),
  status text not null check (status in (
    'awaiting_payment', 'confirmed', 'cancelled', 'expired', 'refunded', 'partially_refunded'
  )),
  payment_status text not null check (payment_status in (
    'pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'
  )),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in (
    'unfulfilled', 'partial', 'fulfilled', 'cancelled'
  )),
  fulfillment_method text not null check (fulfillment_method in (
    'none', 'pickup', 'shipping', 'mixed'
  )),
  subtotal_gross_grosz integer not null check (subtotal_gross_grosz >= 0),
  shipping_gross_grosz integer not null default 0 check (shipping_gross_grosz >= 0),
  total_gross_grosz integer not null check (total_gross_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  shipping_quote_required boolean not null default false,
  customer_notes text,
  internal_notes text,
  source text not null default 'website' check (source in ('website', 'admin')),
  terms_accepted_at timestamptz not null,
  privacy_policy_version text not null,
  public_lookup_token_hash text,
  expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.orders is
  'Cart checkout aggregate linking workshop bookings and physical product lines.';

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_orders_customer on public.orders (customer_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "Managers and owners can view orders" on public.orders;
create policy "Managers and owners can view orders"
  on public.orders for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Managers and owners can update orders" on public.orders;
create policy "Managers and owners can update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage orders" on public.orders;
create policy "Service role can manage orders"
  on public.orders for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.order_addresses (
  order_id uuid primary key references public.orders(id) on delete cascade,
  recipient_name text not null,
  street_line1 text not null,
  street_line2 text,
  postal_code text not null,
  city text not null,
  country text not null default 'PL',
  phone text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.order_addresses is
  'Delivery addresses collected only when a cart requires shipping.';

alter table public.order_addresses enable row level security;

drop policy if exists "Managers and owners can view order addresses" on public.order_addresses;
create policy "Managers and owners can view order addresses"
  on public.order_addresses for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage order addresses" on public.order_addresses;
create policy "Service role can manage order addresses"
  on public.order_addresses for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check (item_type in (
    'workshop_session', 'physical_product', 'studio_service'
  )),
  product_id uuid references public.products(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  workshop_session_id uuid references public.workshop_sessions(id) on delete set null,
  title_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_gross_grosz integer not null check (unit_price_gross_grosz >= 0),
  line_total_gross_grosz integer not null check (line_total_gross_grosz >= 0),
  fulfillment_method text check (fulfillment_method in ('pickup', 'shipping', 'none')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint order_items_line_total_check
    check (line_total_gross_grosz = quantity * unit_price_gross_grosz)
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_booking on public.order_items (booking_id)
  where booking_id is not null;

alter table public.order_items enable row level security;

drop policy if exists "Managers and owners can view order items" on public.order_items;
create policy "Managers and owners can view order items"
  on public.order_items for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage order items" on public.order_items;
create policy "Service role can manage order items"
  on public.order_items for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'customer', 'admin')),
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_order_events_order on public.order_events (order_id, created_at desc);

alter table public.order_events enable row level security;

drop policy if exists "Managers and owners can view order events" on public.order_events;
create policy "Managers and owners can view order events"
  on public.order_events for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage order events" on public.order_events;
create policy "Service role can manage order events"
  on public.order_events for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  email_type text not null check (email_type in (
    'customer_confirmation', 'admin_notification'
  )),
  recipient text not null,
  status text not null check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_order_emails_order on public.order_emails (order_id, created_at desc);
create index if not exists idx_order_emails_dispatch
  on public.order_emails (status, next_attempt_at)
  where status in ('pending', 'failed');

alter table public.order_emails enable row level security;

drop policy if exists "Managers and owners can view order emails" on public.order_emails;
create policy "Managers and owners can view order emails"
  on public.order_emails for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage order emails" on public.order_emails;
create policy "Service role can manage order emails"
  on public.order_emails for all
  to service_role
  using (true)
  with check (true);

-- Link bookings and payments to orders
alter table public.bookings
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists idx_bookings_order on public.bookings (order_id)
  where order_id is not null;

alter table public.payments
  alter column booking_id drop not null;

alter table public.payments
  add column if not exists order_id uuid references public.orders(id) on delete set null;

alter table public.payments
  drop constraint if exists payments_booking_or_order_check;

alter table public.payments
  add constraint payments_booking_or_order_check
  check (booking_id is not null or order_id is not null);

create index if not exists idx_payments_order on public.payments (order_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- Order reference generator
-- ---------------------------------------------------------------------------

create or replace function public.generate_order_reference()
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ref text;
  v_exists boolean;
begin
  loop
    v_ref := 'CN-O-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    select exists(select 1 from public.orders where order_reference = v_ref) into v_exists;
    exit when not v_exists;
  end loop;
  return v_ref;
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic mixed-cart submission
-- p_lines jsonb array of:
--   { type: 'workshop_session', session_id, quantity, participants: [...] }
--   { type: 'physical_product'|'studio_service', product_id, quantity, fulfillment: 'pickup'|'shipping' }
-- ---------------------------------------------------------------------------

create or replace function public.submit_cart_order(
  p_idempotency_key text,
  p_customer_email text,
  p_customer_first_name text,
  p_customer_last_name text,
  p_customer_phone text,
  p_customer_notes text,
  p_marketing_consent boolean,
  p_terms_accepted_at timestamptz,
  p_privacy_policy_version text,
  p_lines jsonb,
  p_shipping_address jsonb default null,
  p_source text default 'website'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
  v_existing public.orders;
  v_customer_id uuid;
  v_order_id uuid;
  v_order_ref text;
  v_line jsonb;
  v_session public.workshop_sessions;
  v_workshop public.workshops;
  v_product public.products;
  v_session_ids uuid[];
  v_sid uuid;
  v_unit_price int;
  v_qty int;
  v_subtotal int := 0;
  v_shipping int := 0;
  v_shipping_quote boolean := false;
  v_needs_shipping boolean := false;
  v_needs_pickup boolean := false;
  v_fulfillment_method text := 'none';
  v_booking_id uuid;
  v_booking_ref text;
  v_booking_refs text[] := '{}';
  v_participant jsonb;
  v_age int;
  v_available int;
  v_payment_id uuid;
  v_item_type text;
  v_title text;
  v_line_fulfillment text;
  v_public_token text;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key is required';
  end if;

  select * into v_existing
  from public.orders
  where idempotency_key = trim(p_idempotency_key)
  limit 1;

  if found then
    select coalesce(array_agg(b.booking_reference order by b.created_at), '{}')
      into v_booking_refs
    from public.bookings b
    where b.order_id = v_existing.id;

    select id into v_payment_id
    from public.payments
    where order_id = v_existing.id
    order by created_at asc
    limit 1;

    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_reference', v_existing.order_reference,
      'payment_id', v_payment_id,
      'booking_references', to_jsonb(v_booking_refs),
      'total_gross_grosz', v_existing.total_gross_grosz,
      'shipping_quote_required', v_existing.shipping_quote_required,
      'reused', true
    );
  end if;

  if p_lines is null or jsonb_typeof(p_lines) != 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Cart is empty';
  end if;

  if jsonb_array_length(p_lines) > 20 then
    raise exception 'Too many cart lines';
  end if;

  -- Lock sessions in deterministic order
  select coalesce(array_agg((elem->>'session_id')::uuid order by (elem->>'session_id')), '{}')
    into v_session_ids
  from jsonb_array_elements(p_lines) as elem
  where elem->>'type' = 'workshop_session'
    and elem->>'session_id' is not null;

  if v_session_ids is not null then
    foreach v_sid in array v_session_ids
    loop
      perform 1 from public.workshop_sessions where id = v_sid for update;
    end loop;
  end if;

  -- Create / update customer
  insert into public.customer_profiles (
    email, first_name, last_name, phone, marketing_consent, marketing_consent_at,
    privacy_policy_version
  ) values (
    lower(trim(p_customer_email)),
    trim(p_customer_first_name),
    trim(p_customer_last_name),
    nullif(trim(p_customer_phone), ''),
    p_marketing_consent,
    case when p_marketing_consent then v_now else null end,
    p_privacy_policy_version
  )
  on conflict (lower(email)) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    marketing_consent = excluded.marketing_consent,
    marketing_consent_at = excluded.marketing_consent_at,
    privacy_policy_version = excluded.privacy_policy_version,
    updated_at = v_now
  returning id into v_customer_id;

  -- First pass: validate and compute totals
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_type := v_line->>'type';
    v_qty := coalesce((v_line->>'quantity')::int, 0);
    if v_qty <= 0 or v_qty > 10 then
      raise exception 'Invalid quantity';
    end if;

    if v_item_type = 'workshop_session' then
      select * into v_session
      from public.workshop_sessions
      where id = (v_line->>'session_id')::uuid;

      if not found then
        raise exception 'Session not found';
      end if;

      select * into v_workshop from public.workshops where id = v_session.workshop_id;
      if v_workshop.status != 'published' or v_workshop.archived_at is not null then
        raise exception 'Workshop is not available';
      end if;
      if v_workshop.booking_mode != 'scheduled' then
        raise exception 'Workshop is not bookable via cart';
      end if;
      if v_session.status not in ('scheduled', 'sold_out') then
        raise exception 'Session is not open for booking';
      end if;
      if v_session.starts_at <= v_now then
        raise exception 'Session has already started or passed';
      end if;
      if v_session.booking_opens_at is not null and v_session.booking_opens_at > v_now then
        raise exception 'Booking is not yet open';
      end if;
      if v_session.booking_closes_at is not null and v_session.booking_closes_at < v_now then
        raise exception 'Booking has closed';
      end if;

      v_available := v_session.capacity - v_session.reserved_count;
      if v_available < v_qty then
        raise exception 'Insufficient capacity';
      end if;

      if v_line->'participants' is null
         or jsonb_array_length(v_line->'participants') != v_qty then
        raise exception 'Participant count must match quantity';
      end if;

      if v_workshop.minimum_age is not null or v_workshop.maximum_age is not null then
        for v_participant in select * from jsonb_array_elements(v_line->'participants')
        loop
          if (v_participant->>'age') is null or (v_participant->>'age') = '' then
            raise exception 'Participant age is required for this workshop';
          end if;
          v_age := (v_participant->>'age')::int;
          if v_age < coalesce(v_workshop.minimum_age, 0)
             or v_age > coalesce(v_workshop.maximum_age, 999) then
            raise exception 'Participant age is outside workshop limits';
          end if;
        end loop;
      end if;

      v_unit_price := coalesce(v_session.price_gross_grosz, v_workshop.default_price_gross_grosz);
      v_subtotal := v_subtotal + (v_unit_price * v_qty);

    elsif v_item_type in ('physical_product', 'studio_service') then
      select * into v_product
      from public.products
      where id = (v_line->>'product_id')::uuid
      for update;

      if not found then
        raise exception 'Product not found';
      end if;
      if v_product.status != 'published' or v_product.archived_at is not null then
        raise exception 'Product is not available';
      end if;
      if v_product.track_inventory and v_product.inventory_quantity < v_qty then
        raise exception 'Insufficient product inventory';
      end if;

      v_line_fulfillment := coalesce(v_line->>'fulfillment', 'pickup');
      if v_line_fulfillment = 'shipping' then
        if not v_product.requires_shipping and v_product.product_type = 'studio_service' then
          -- studio services may still ship finished work; allow when flagged
          null;
        end if;
        if not v_product.requires_shipping and v_product.product_type = 'physical_product' then
          -- physical products that support shipping must have requires_shipping
          if not v_product.requires_shipping then
            raise exception 'Product cannot be shipped';
          end if;
        end if;
        if v_product.requires_shipping then
          v_needs_shipping := true;
          if v_product.shipping_fee_mode = 'quote_required' then
            v_shipping_quote := true;
          elsif v_product.shipping_fee_mode = 'fixed' then
            v_shipping := v_shipping + coalesce(v_product.shipping_fee_gross_grosz, 0) * v_qty;
          end if;
        end if;
      elsif v_line_fulfillment = 'pickup' then
        if not v_product.allows_pickup then
          raise exception 'Product does not allow pickup';
        end if;
        v_needs_pickup := true;
      else
        raise exception 'Invalid fulfillment method';
      end if;

      v_unit_price := v_product.price_gross_grosz;
      v_subtotal := v_subtotal + (v_unit_price * v_qty);
    else
      raise exception 'Unsupported cart line type';
    end if;
  end loop;

  if v_needs_shipping then
    if p_shipping_address is null then
      raise exception 'Shipping address is required';
    end if;
    if coalesce(p_shipping_address->>'recipient_name', '') = ''
       or coalesce(p_shipping_address->>'street_line1', '') = ''
       or coalesce(p_shipping_address->>'postal_code', '') = ''
       or coalesce(p_shipping_address->>'city', '') = '' then
      raise exception 'Incomplete shipping address';
    end if;
    if coalesce(p_shipping_address->>'country', 'PL') not in ('PL') then
      raise exception 'Unsupported shipping country';
    end if;
  end if;

  if v_needs_shipping and v_needs_pickup then
    v_fulfillment_method := 'mixed';
  elsif v_needs_shipping then
    v_fulfillment_method := 'shipping';
  elsif v_needs_pickup then
    v_fulfillment_method := 'pickup';
  else
    v_fulfillment_method := 'none';
  end if;

  v_public_token := encode(gen_random_bytes(24), 'hex');

  insert into public.orders (
    order_reference, idempotency_key, customer_id, status, payment_status,
    fulfillment_status, fulfillment_method, subtotal_gross_grosz, shipping_gross_grosz,
    total_gross_grosz, currency, shipping_quote_required, customer_notes, source,
    terms_accepted_at, privacy_policy_version, public_lookup_token_hash, expires_at
  ) values (
    public.generate_order_reference(),
    trim(p_idempotency_key),
    v_customer_id,
    'awaiting_payment',
    'pending',
    'unfulfilled',
    v_fulfillment_method,
    v_subtotal,
    v_shipping,
    v_subtotal + v_shipping,
    'PLN',
    v_shipping_quote,
    nullif(trim(coalesce(p_customer_notes, '')), ''),
    coalesce(nullif(trim(p_source), ''), 'website'),
    p_terms_accepted_at,
    p_privacy_policy_version,
    encode(digest(v_public_token, 'sha256'), 'hex'),
    -- Bank-transfer orders do not expire after 15 minutes (Stripe hold).
    -- Studio confirms payment manually; no automatic expiry deadline invented.
    null
  ) returning id, order_reference into v_order_id, v_order_ref;

  if v_needs_shipping then
    insert into public.order_addresses (
      order_id, recipient_name, street_line1, street_line2, postal_code, city, country, phone
    ) values (
      v_order_id,
      trim(p_shipping_address->>'recipient_name'),
      trim(p_shipping_address->>'street_line1'),
      nullif(trim(coalesce(p_shipping_address->>'street_line2', '')), ''),
      trim(p_shipping_address->>'postal_code'),
      trim(p_shipping_address->>'city'),
      coalesce(nullif(trim(p_shipping_address->>'country'), ''), 'PL'),
      nullif(trim(coalesce(p_shipping_address->>'phone', p_customer_phone, '')), '')
    );
  end if;

  -- Second pass: create bookings, product lines, reserve capacity/inventory
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_item_type := v_line->>'type';
    v_qty := (v_line->>'quantity')::int;

    if v_item_type = 'workshop_session' then
      select * into v_session
      from public.workshop_sessions
      where id = (v_line->>'session_id')::uuid;

      select * into v_workshop from public.workshops where id = v_session.workshop_id;
      v_unit_price := coalesce(v_session.price_gross_grosz, v_workshop.default_price_gross_grosz);
      v_title := v_workshop.title;

      insert into public.bookings (
        customer_id, workshop_session_id, status, quantity, unit_price_gross_grosz,
        total_price_gross_grosz, currency, customer_notes, source,
        terms_accepted_at, privacy_policy_version, expires_at, order_id
      ) values (
        v_customer_id, v_session.id, 'awaiting_payment', v_qty, v_unit_price,
        v_unit_price * v_qty, 'PLN', nullif(trim(coalesce(p_customer_notes, '')), ''),
        coalesce(nullif(trim(p_source), ''), 'website'),
        p_terms_accepted_at, p_privacy_policy_version, null, v_order_id
      ) returning id, booking_reference into v_booking_id, v_booking_ref;

      v_booking_refs := array_append(v_booking_refs, v_booking_ref);

      insert into public.booking_participants (
        booking_id, display_name, age, participant_type, accessibility_notes
      )
      select
        v_booking_id,
        nullif(trim(elem->>'display_name'), ''),
        nullif(elem->>'age', '')::int,
        coalesce(elem->>'participant_type', 'unspecified'),
        nullif(elem->>'accessibility_notes', '')
      from jsonb_array_elements(v_line->'participants') as elem;

      update public.workshop_sessions
      set reserved_count = reserved_count + v_qty,
          updated_at = v_now
      where id = v_session.id;

      insert into public.booking_events (
        booking_id, event_type, actor_type, metadata
      ) values (
        v_booking_id, 'reserved', 'customer',
        jsonb_build_object(
          'order_id', v_order_id,
          'quantity', v_qty,
          'unit_price_gross_grosz', v_unit_price
        )
      );

      insert into public.order_items (
        order_id, item_type, booking_id, workshop_session_id, title_snapshot,
        quantity, unit_price_gross_grosz, line_total_gross_grosz, fulfillment_method,
        metadata
      ) values (
        v_order_id, 'workshop_session', v_booking_id, v_session.id, v_title,
        v_qty, v_unit_price, v_unit_price * v_qty, 'none',
        jsonb_build_object(
          'starts_at', v_session.starts_at,
          'venue_key', v_session.venue_key,
          'location_name', v_session.location_name,
          'location_address', v_session.location_address
        )
      );

    else
      select * into v_product
      from public.products
      where id = (v_line->>'product_id')::uuid;

      v_unit_price := v_product.price_gross_grosz;
      v_title := v_product.title;
      v_line_fulfillment := coalesce(v_line->>'fulfillment', 'pickup');

      if v_product.track_inventory then
        update public.products
        set inventory_quantity = inventory_quantity - v_qty,
            updated_at = v_now
        where id = v_product.id
          and inventory_quantity >= v_qty;
        if not found then
          raise exception 'Insufficient product inventory';
        end if;
      end if;

      insert into public.order_items (
        order_id, item_type, product_id, title_snapshot, quantity,
        unit_price_gross_grosz, line_total_gross_grosz, fulfillment_method, metadata
      ) values (
        v_order_id,
        case when v_product.product_type = 'studio_service' then 'studio_service' else 'physical_product' end,
        v_product.id, v_title, v_qty, v_unit_price, v_unit_price * v_qty,
        v_line_fulfillment,
        jsonb_build_object('sku', v_product.sku, 'slug', v_product.slug)
      );
    end if;
  end loop;

  insert into public.payments (
    booking_id, order_id, provider, status, amount_gross_grosz, currency, idempotency_key
  ) values (
    null, v_order_id, 'bank_transfer', 'pending', v_subtotal + v_shipping, 'PLN',
    trim(p_idempotency_key)
  ) returning id into v_payment_id;

  insert into public.order_events (
    order_id, event_type, actor_type, metadata
  ) values (
    v_order_id, 'created', 'customer',
    jsonb_build_object(
      'line_count', jsonb_array_length(p_lines),
      'total_gross_grosz', v_subtotal + v_shipping,
      'shipping_quote_required', v_shipping_quote
    )
  );

  -- Queue customer confirmation once. Admin notification recipient is filled
  -- by the application layer (BOOKING_ADMIN_EMAIL) when dispatching.
  insert into public.order_emails (order_id, email_type, recipient, status)
  values
    (v_order_id, 'customer_confirmation', lower(trim(p_customer_email)), 'pending');

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_reference', v_order_ref,
    'payment_id', v_payment_id,
    'booking_references', to_jsonb(v_booking_refs),
    'total_gross_grosz', v_subtotal + v_shipping,
    'shipping_quote_required', v_shipping_quote,
    'public_lookup_token', v_public_token,
    'reused', false
  );
end;
$$;

comment on function public.submit_cart_order is
  'Atomic mixed-cart checkout: workshops + products, all-or-nothing, idempotent.';

revoke all on function public.submit_cart_order(
  text, text, text, text, text, text, boolean, timestamptz, text, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.submit_cart_order(
  text, text, text, text, text, text, boolean, timestamptz, text, jsonb, jsonb, text
) to service_role;

grant execute on function public.generate_order_reference() to service_role;
