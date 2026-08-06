-- Ceramika Nero — gift vouchers as a first-class payment instrument.
-- Apply after migration 20. This migration is additive and keeps migrations 00–20 immutable.

alter table public.orders
  add column if not exists gross_before_voucher_grosz integer,
  add column if not exists voucher_applied_grosz integer not null default 0;

alter table public.order_items
  drop constraint if exists order_items_item_type_check;

alter table public.order_items
  add constraint order_items_item_type_check
  check (item_type in (
    'workshop_session', 'physical_product', 'studio_service', 'voucher_payment'
  ));

alter table public.orders
  drop constraint if exists orders_voucher_applied_nonnegative,
  add constraint orders_voucher_applied_nonnegative
    check (voucher_applied_grosz >= 0),
  drop constraint if exists orders_voucher_not_above_gross,
  add constraint orders_voucher_not_above_gross
    check (
      gross_before_voucher_grosz is null
      or voucher_applied_grosz <= gross_before_voucher_grosz
    );

create table if not exists public.gift_voucher_providers (
  code text primary key check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  adapter_type text not null default 'database'
    check (adapter_type in ('database', 'http_json')),
  code_prefix text,
  api_base_url text,
  api_secret_env_key text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.gift_voucher_providers (code, name, adapter_type, is_active)
values
  ('ceramika_nero', 'Ceramika Nero', 'database', true),
  ('prezent_marzen', 'Prezent Marzeń', 'database', true)
on conflict (code) do update
set name = excluded.name,
    is_active = true,
    updated_at = timezone('utc'::text, now());

create table if not exists public.gift_vouchers (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null references public.gift_voucher_providers(code),
  code_hash text not null unique check (length(code_hash) = 64),
  code_last4 text not null check (length(code_last4) between 1 and 4),
  voucher_type text not null default 'fixed_amount'
    check (voucher_type in ('fixed_amount', 'workshop_specific', 'experience')),
  description text,
  original_value_grosz integer not null check (original_value_grosz > 0),
  remaining_value_grosz integer not null check (remaining_value_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  valid_from timestamptz not null default timezone('utc'::text, now()),
  valid_until timestamptz,
  status text not null default 'active'
    check (status in ('active', 'partially_redeemed', 'redeemed', 'expired', 'cancelled')),
  multi_use boolean not null default true,
  allowed_workshop_types text[] not null default '{}'::text[],
  allowed_workshop_ids uuid[] not null default '{}'::uuid[],
  refund_policy text not null default 'restore'
    check (refund_policy in ('restore', 'replacement')),
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  cancelled_at timestamptz,
  constraint gift_voucher_remaining_not_above_original
    check (remaining_value_grosz <= original_value_grosz),
  constraint gift_voucher_validity_window
    check (valid_until is null or valid_until > valid_from)
);

create index if not exists idx_gift_vouchers_provider_status
  on public.gift_vouchers(provider_code, status);
create index if not exists idx_gift_vouchers_valid_until
  on public.gift_vouchers(valid_until)
  where valid_until is not null;

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.gift_vouchers(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_grosz integer not null check (amount_grosz > 0),
  status text not null
    check (status in ('reserved', 'committed', 'released', 'refunded')),
  idempotency_key text not null unique,
  provider_reference text,
  remaining_after_grosz integer not null check (remaining_after_grosz >= 0),
  metadata jsonb not null default '{}'::jsonb,
  reserved_at timestamptz not null default timezone('utc'::text, now()),
  committed_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_voucher_redemptions_active_order
  on public.voucher_redemptions(voucher_id, order_id)
  where status in ('reserved', 'committed');
create index if not exists idx_voucher_redemptions_order
  on public.voucher_redemptions(order_id, created_at desc);

create table if not exists public.voucher_provider_logs (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null references public.gift_voucher_providers(code),
  voucher_id uuid references public.gift_vouchers(id) on delete set null,
  action text not null check (action in ('validate', 'import', 'reserve', 'commit', 'release', 'refund', 'api_error')),
  request_fingerprint text,
  response_summary jsonb not null default '{}'::jsonb,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_voucher_provider_logs_created
  on public.voucher_provider_logs(provider_code, created_at desc);

create table if not exists public.voucher_issue_secrets (
  voucher_id uuid primary key references public.gift_vouchers(id) on delete cascade,
  raw_code text not null,
  reason text not null,
  revealed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.gift_voucher_providers enable row level security;
alter table public.gift_vouchers enable row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.voucher_provider_logs enable row level security;
alter table public.voucher_issue_secrets enable row level security;

revoke all on table public.gift_voucher_providers from public, anon, authenticated;
revoke all on table public.gift_vouchers from public, anon, authenticated;
revoke all on table public.voucher_redemptions from public, anon, authenticated;
revoke all on table public.voucher_provider_logs from public, anon, authenticated;
revoke all on table public.voucher_issue_secrets from public, anon, authenticated;

grant select, insert, update, delete on table public.gift_voucher_providers to service_role;
grant select, insert, update, delete on table public.gift_vouchers to service_role;
grant select, insert, update, delete on table public.voucher_redemptions to service_role;
grant select, insert, update, delete on table public.voucher_provider_logs to service_role;
grant select, insert, update, delete on table public.voucher_issue_secrets to service_role;

create trigger trg_gift_voucher_providers_updated_at
before update on public.gift_voucher_providers
for each row execute function public.set_updated_at();

create trigger trg_gift_vouchers_updated_at
before update on public.gift_vouchers
for each row execute function public.set_updated_at();

create trigger trg_voucher_redemptions_updated_at
before update on public.voucher_redemptions
for each row execute function public.set_updated_at();

create or replace function public.voucher_code_hash(p_code text)
returns text
language sql
immutable
strict
set search_path = public, pg_catalog
as $$
  select encode(digest(regexp_replace(upper(trim(p_code)), '\s+', '', 'g'), 'sha256'), 'hex')
$$;

revoke all on function public.voucher_code_hash(text) from public, anon, authenticated;
grant execute on function public.voucher_code_hash(text) to service_role;

create or replace function public.assert_voucher_cart_eligibility(
  p_voucher_id uuid,
  p_lines jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_voucher public.gift_vouchers;
  v_line_count integer;
  v_session_count integer;
  v_workshop_ids uuid[];
  v_category_slugs text[];
begin
  select * into v_voucher
  from public.gift_vouchers
  where id = p_voucher_id;
  if not found then raise exception 'Voucher not found'; end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Voucher cart is empty';
  end if;

  select count(*) into v_line_count
  from jsonb_array_elements(p_lines) line
  where line ->> 'type' = 'workshop_session';

  if v_line_count <> jsonb_array_length(p_lines) then
    raise exception 'Voucher can only be used for workshop bookings';
  end if;

  select count(*), array_agg(distinct ws.workshop_id), array_agg(distinct wc.slug)
  into v_session_count, v_workshop_ids, v_category_slugs
  from jsonb_array_elements(p_lines) line
  join public.workshop_sessions ws on ws.id = (line ->> 'session_id')::uuid
  join public.workshops w on w.id = ws.workshop_id
  left join public.workshop_categories wc on wc.id = w.category_id
  where line ->> 'type' = 'workshop_session';

  if v_session_count <> v_line_count then
    raise exception 'Voucher workshop session is invalid';
  end if;

  if cardinality(v_voucher.allowed_workshop_ids) > 0
     and exists (
       select 1 from unnest(v_workshop_ids) workshop_id
       where not (workshop_id = any(v_voucher.allowed_workshop_ids))
     )
  then
    raise exception 'Voucher is not valid for one or more selected workshops';
  end if;

  if cardinality(v_voucher.allowed_workshop_types) > 0
     and exists (
       select 1 from unnest(v_category_slugs) category_slug
       where category_slug is null
          or not (category_slug = any(v_voucher.allowed_workshop_types))
     )
  then
    raise exception 'Voucher is not valid for one or more workshop types';
  end if;
end;
$$;

revoke all on function public.assert_voucher_cart_eligibility(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.assert_voucher_cart_eligibility(uuid, jsonb)
  to service_role;

create or replace function public.validate_checkout_voucher(
  p_code text,
  p_lines jsonb,
  p_subtotal_grosz integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_voucher public.gift_vouchers;
  v_provider public.gift_voucher_providers;
  v_now timestamptz := timezone('utc'::text, now());
  v_applied integer;
begin
  if length(trim(coalesce(p_code, ''))) < 4 then raise exception 'Voucher code is invalid'; end if;
  if coalesce(p_subtotal_grosz, 0) <= 0 then raise exception 'Voucher order total is invalid'; end if;

  select * into v_voucher
  from public.gift_vouchers
  where code_hash = public.voucher_code_hash(p_code);

  if not found then raise exception 'Voucher not found'; end if;

  select * into v_provider
  from public.gift_voucher_providers
  where code = v_voucher.provider_code
    and is_active = true;

  if not found then raise exception 'Voucher provider is unavailable'; end if;
  if v_voucher.status = 'cancelled' then raise exception 'Voucher is cancelled'; end if;
  if v_voucher.valid_from > v_now then raise exception 'Voucher is not active yet'; end if;
  if v_voucher.valid_until is not null and v_voucher.valid_until < v_now then
    raise exception 'Voucher is expired';
  end if;
  if v_voucher.status not in ('active', 'partially_redeemed')
     or v_voucher.remaining_value_grosz <= 0 then
    raise exception 'Voucher has already been redeemed';
  end if;

  perform public.assert_voucher_cart_eligibility(v_voucher.id, p_lines);
  v_applied := least(v_voucher.remaining_value_grosz, p_subtotal_grosz);

  insert into public.voucher_provider_logs (
    provider_code, voucher_id, action, request_fingerprint, response_summary, success
  ) values (
    v_voucher.provider_code, v_voucher.id, 'validate',
    left(public.voucher_code_hash(p_code), 16),
    jsonb_build_object('applicable_grosz', v_applied, 'amount_due_grosz', p_subtotal_grosz - v_applied),
    true
  );

  return jsonb_build_object(
    'voucher_id', v_voucher.id,
    'provider_code', v_voucher.provider_code,
    'provider_name', v_provider.name,
    'voucher_type', v_voucher.voucher_type,
    'description', v_voucher.description,
    'masked_code', '••••' || v_voucher.code_last4,
    'remaining_value_grosz', v_voucher.remaining_value_grosz,
    'applicable_grosz', v_applied,
    'amount_due_grosz', p_subtotal_grosz - v_applied,
    'currency', v_voucher.currency,
    'valid_until', v_voucher.valid_until,
    'allowed_workshop_types', v_voucher.allowed_workshop_types,
    'allowed_workshop_ids', v_voucher.allowed_workshop_ids
  );
end;
$$;

revoke all on function public.validate_checkout_voucher(text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.validate_checkout_voucher(text, jsonb, integer)
  to service_role;

create or replace function public.register_external_voucher(
  p_provider_code text,
  p_code text,
  p_provider_reference text,
  p_description text,
  p_voucher_type text,
  p_original_value_grosz integer,
  p_remaining_value_grosz integer,
  p_currency text,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_multi_use boolean,
  p_allowed_workshop_types text[],
  p_allowed_workshop_ids uuid[],
  p_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.gift_voucher_providers
    where code = p_provider_code and is_active = true
  ) then
    raise exception 'Voucher provider is unavailable';
  end if;

  insert into public.gift_vouchers (
    provider_code, code_hash, code_last4, voucher_type, description,
    original_value_grosz, remaining_value_grosz, currency,
    valid_from, valid_until, status, multi_use,
    allowed_workshop_types, allowed_workshop_ids,
    external_reference, metadata
  ) values (
    p_provider_code,
    public.voucher_code_hash(p_code),
    right(regexp_replace(upper(trim(p_code)), '\s+', '', 'g'), 4),
    p_voucher_type,
    p_description,
    p_original_value_grosz,
    p_remaining_value_grosz,
    upper(p_currency),
    coalesce(p_valid_from, timezone('utc'::text, now())),
    p_valid_until,
    case
      when p_remaining_value_grosz <= 0 then 'redeemed'
      when p_remaining_value_grosz < p_original_value_grosz then 'partially_redeemed'
      else 'active'
    end,
    p_multi_use,
    coalesce(p_allowed_workshop_types, '{}'::text[]),
    coalesce(p_allowed_workshop_ids, '{}'::uuid[]),
    p_provider_reference,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (code_hash) do update
  set description = excluded.description,
      original_value_grosz = excluded.original_value_grosz,
      remaining_value_grosz = excluded.remaining_value_grosz,
      valid_from = excluded.valid_from,
      valid_until = excluded.valid_until,
      status = excluded.status,
      external_reference = excluded.external_reference,
      metadata = public.gift_vouchers.metadata || excluded.metadata,
      updated_at = timezone('utc'::text, now())
  where public.gift_vouchers.provider_code = excluded.provider_code
  returning id into v_id;

  if v_id is null then raise exception 'Voucher code belongs to another provider'; end if;

  insert into public.voucher_provider_logs (
    provider_code, voucher_id, action, request_fingerprint, response_summary, success
  ) values (
    p_provider_code, v_id, 'import', left(public.voucher_code_hash(p_code), 16),
    jsonb_build_object('provider_reference', p_provider_reference), true
  );

  return v_id;
end;
$$;

revoke all on function public.register_external_voucher(
  text, text, text, text, text, integer, integer, text,
  timestamptz, timestamptz, boolean, text[], uuid[], jsonb
) from public, anon, authenticated;
grant execute on function public.register_external_voucher(
  text, text, text, text, text, integer, integer, text,
  timestamptz, timestamptz, boolean, text[], uuid[], jsonb
) to service_role;

create or replace function public.submit_cart_order_v2(
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
  p_shipping_address jsonb,
  p_source text,
  p_selected_payment_method text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_order public.orders;
  v_order_id uuid;
  v_payment_id uuid;
  v_public_token text;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if p_selected_payment_method not in ('stripe', 'bank_transfer') then
    raise exception 'Unsupported payment method';
  end if;

  v_result := public.submit_cart_order(
    p_idempotency_key, p_customer_email, p_customer_first_name,
    p_customer_last_name, p_customer_phone, p_customer_notes,
    p_marketing_consent, p_terms_accepted_at, p_privacy_policy_version,
    p_lines, p_shipping_address, p_source
  );

  v_order_id := (v_result ->> 'order_id')::uuid;
  v_payment_id := nullif(v_result ->> 'payment_id', '')::uuid;
  v_public_token := nullif(v_result ->> 'public_lookup_token', '');

  select * into v_order from public.orders where id = v_order_id for update;
  if not found then raise exception 'Order not found after submission'; end if;

  if coalesce((v_result ->> 'reused')::boolean, false)
     and v_order.selected_payment_method is not null
     and v_order.selected_payment_method not in (p_selected_payment_method, 'voucher') then
    raise exception 'Idempotency key belongs to a different payment method';
  end if;

  if v_order.selected_payment_method <> 'voucher' then
    update public.orders
    set selected_payment_method = p_selected_payment_method, updated_at = v_now
    where id = v_order_id;

    if v_payment_id is not null then
      update public.payments
      set provider = case when p_selected_payment_method = 'stripe' then 'stripe' else 'bank_transfer' end,
          status = case when p_selected_payment_method = 'stripe' then 'created' else 'pending' end,
          updated_at = v_now
      where id = v_payment_id and status in ('created', 'pending');
    end if;
  end if;

  if v_public_token is not null then
    insert into public.order_portal_token_recovery (order_id, public_lookup_token)
    values (v_order_id, v_public_token)
    on conflict (order_id) do nothing;
  else
    select nullif(t.public_lookup_token, '') into v_public_token
    from public.order_portal_token_recovery t
    where t.order_id = v_order_id;
    if v_public_token is not null then
      v_result := jsonb_set(v_result, '{public_lookup_token}', to_jsonb(v_public_token), true);
    end if;
  end if;

  return v_result;
end;
$$;

create or replace function public.submit_cart_order_v3(
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
  p_shipping_address jsonb,
  p_source text,
  p_selected_payment_method text,
  p_voucher_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
  v_order public.orders;
  v_voucher public.gift_vouchers;
  v_provider public.gift_voucher_providers;
  v_existing_redemption public.voucher_redemptions;
  v_order_id uuid;
  v_payment_id uuid;
  v_redemption_id uuid;
  v_now timestamptz := timezone('utc'::text, now());
  v_original_total integer;
  v_applied integer;
  v_due integer;
  v_remaining integer;
  v_balance_before integer;
  v_reused boolean;
begin
  v_result := public.submit_cart_order_v2(
    p_idempotency_key, p_customer_email, p_customer_first_name,
    p_customer_last_name, p_customer_phone, p_customer_notes,
    p_marketing_consent, p_terms_accepted_at, p_privacy_policy_version,
    p_lines, p_shipping_address, p_source, p_selected_payment_method
  );

  v_order_id := (v_result ->> 'order_id')::uuid;
  v_payment_id := nullif(v_result ->> 'payment_id', '')::uuid;
  v_reused := coalesce((v_result ->> 'reused')::boolean, false);
  select * into v_order from public.orders where id = v_order_id for update;

  if nullif(trim(coalesce(p_voucher_code, '')), '') is null then
    if exists (
      select 1 from public.voucher_redemptions
      where order_id = v_order_id and status in ('reserved', 'committed')
    ) then raise exception 'Idempotency key belongs to a voucher order'; end if;
    return v_result || jsonb_build_object(
      'voucher_applied_grosz', 0,
      'amount_due_grosz', v_order.total_gross_grosz
    );
  end if;

  select * into v_existing_redemption
  from public.voucher_redemptions
  where order_id = v_order_id and status in ('reserved', 'committed')
  order by created_at desc limit 1;

  if found then
    if not v_reused then raise exception 'Order already has a voucher redemption'; end if;
    select * into v_voucher
    from public.gift_vouchers
    where id = v_existing_redemption.voucher_id;
    if not found then raise exception 'Voucher not found'; end if;

    select * into v_provider
    from public.gift_voucher_providers
    where code = v_voucher.provider_code;
    if not found then raise exception 'Voucher provider is unavailable'; end if;

    if v_voucher.code_hash <> public.voucher_code_hash(p_voucher_code) then
      raise exception 'Idempotency key belongs to a different voucher';
    end if;
    return v_result || jsonb_build_object(
      'voucher_applied_grosz', v_existing_redemption.amount_grosz,
      'amount_due_grosz', v_order.total_gross_grosz,
      'voucher_provider', v_voucher.provider_code,
      'voucher_provider_name', v_provider.name,
      'voucher_masked_code', '••••' || v_voucher.code_last4,
      'voucher_remaining_grosz', v_voucher.remaining_value_grosz,
      'voucher_fully_paid', v_order.total_gross_grosz = 0
    );
  end if;

  select * into v_voucher
  from public.gift_vouchers
  where code_hash = public.voucher_code_hash(p_voucher_code)
  for update;

  if not found then raise exception 'Voucher not found'; end if;

  select * into v_provider
  from public.gift_voucher_providers
  where code = v_voucher.provider_code
    and is_active = true;

  if not found then raise exception 'Voucher provider is unavailable'; end if;
  if v_voucher.status = 'cancelled' then raise exception 'Voucher is cancelled'; end if;
  if v_voucher.valid_from > v_now then raise exception 'Voucher is not active yet'; end if;
  if v_voucher.valid_until is not null and v_voucher.valid_until < v_now then
    raise exception 'Voucher is expired';
  end if;
  if v_voucher.status not in ('active', 'partially_redeemed')
     or v_voucher.remaining_value_grosz <= 0 then
    raise exception 'Voucher has already been redeemed';
  end if;

  perform public.assert_voucher_cart_eligibility(v_voucher.id, p_lines);

  v_original_total := v_order.total_gross_grosz;
  v_balance_before := v_voucher.remaining_value_grosz;
  v_applied := least(v_balance_before, v_original_total);
  v_due := v_original_total - v_applied;
  v_remaining := v_balance_before - v_applied;
  if not v_voucher.multi_use then v_remaining := 0; end if;

  update public.gift_vouchers
  set remaining_value_grosz = v_remaining,
      status = case when v_remaining = 0 then 'redeemed' else 'partially_redeemed' end,
      updated_at = v_now
  where id = v_voucher.id;

  insert into public.voucher_redemptions (
    voucher_id, order_id, amount_grosz, status, idempotency_key,
    provider_reference, remaining_after_grosz, committed_at, metadata
  ) values (
    v_voucher.id, v_order_id, v_applied,
    case when v_due = 0 then 'committed' else 'reserved' end,
    p_idempotency_key || ':voucher', v_voucher.external_reference,
    v_remaining, case when v_due = 0 then v_now else null end,
    jsonb_build_object(
      'selected_payment_method', p_selected_payment_method,
      'balance_before_grosz', v_balance_before,
      'value_consumed_grosz', case when v_voucher.multi_use then v_applied else v_balance_before end
    )
  ) returning id into v_redemption_id;

  insert into public.order_items (
    order_id, item_type, title_snapshot, quantity,
    unit_price_gross_grosz, line_total_gross_grosz,
    fulfillment_method, metadata
  ) values (
    v_order_id, 'voucher_payment',
    'Bon upominkowy — ' || v_provider.name || ' (••••' || v_voucher.code_last4 ||
      '); wykorzystano ' || replace(to_char(v_applied / 100.0, 'FM999999990D00'), '.', ',') ||
      ' zł; pozostało ' || replace(to_char(v_remaining / 100.0, 'FM999999990D00'), '.', ',') || ' zł',
    1, 0, 0, 'none',
    jsonb_build_object(
      'voucher_payment', true,
      'provider_code', v_voucher.provider_code,
      'provider_name', v_provider.name,
      'masked_code', '••••' || v_voucher.code_last4,
      'amount_used_grosz', v_applied,
      'remaining_value_grosz', v_remaining,
      'redemption_id', v_redemption_id
    )
  );

  if v_payment_id is null then raise exception 'Order payment row is missing'; end if;

  if v_due = 0 then
    update public.payments
    set provider = 'voucher',
        provider_payment_id = v_redemption_id::text,
        status = 'paid',
        amount_gross_grosz = v_applied,
        paid_at = v_now,
        raw_provider_reference = 'voucher:' || v_voucher.provider_code || ':••••' || v_voucher.code_last4,
        updated_at = v_now
    where id = v_payment_id;
  else
    update public.payments
    set amount_gross_grosz = v_due, updated_at = v_now
    where id = v_payment_id;

    insert into public.payments (
      order_id, provider, provider_payment_id, status,
      amount_gross_grosz, currency, idempotency_key,
      raw_provider_reference, created_at, updated_at
    ) values (
      v_order_id, 'voucher', v_redemption_id::text, 'pending',
      v_applied, 'PLN', p_idempotency_key || ':voucher-payment',
      'voucher:' || v_voucher.provider_code || ':••••' || v_voucher.code_last4,
      v_now - interval '1 second', v_now - interval '1 second'
    );
  end if;

  update public.orders
  set gross_before_voucher_grosz = v_original_total,
      voucher_applied_grosz = v_applied,
      total_gross_grosz = v_due,
      selected_payment_method = case when v_due = 0 then 'voucher' else p_selected_payment_method end,
      payment_status = case when v_due = 0 then 'paid' else payment_status end,
      status = case when v_due = 0 then 'confirmed' else status end,
      confirmed_at = case when v_due = 0 then coalesce(confirmed_at, v_now) else confirmed_at end,
      expires_at = case when v_due = 0 then null else expires_at end,
      updated_at = v_now
  where id = v_order_id;

  if v_due = 0 then
    update public.bookings
    set status = 'confirmed', confirmed_at = coalesce(confirmed_at, v_now),
        expires_at = null, updated_at = v_now
    where order_id = v_order_id and status in ('pending', 'awaiting_payment');

    insert into public.booking_events (booking_id, event_type, actor_type, metadata)
    select id, 'confirmed', 'system',
      jsonb_build_object('via', 'voucher', 'voucher_redemption_id', v_redemption_id)
    from public.bookings where order_id = v_order_id;
  end if;

  insert into public.voucher_provider_logs (
    provider_code, voucher_id, action, request_fingerprint, response_summary, success
  ) values (
    v_voucher.provider_code, v_voucher.id, 'reserve', left(v_voucher.code_hash, 16),
    jsonb_build_object(
      'order_id', v_order_id,
      'redemption_id', v_redemption_id,
      'amount_grosz', v_applied,
      'amount_due_grosz', v_due,
      'committed', v_due = 0
    ), true
  );

  return v_result || jsonb_build_object(
    'total_gross_grosz', v_due,
    'voucher_applied_grosz', v_applied,
    'amount_due_grosz', v_due,
    'voucher_provider', v_voucher.provider_code,
    'voucher_provider_name', v_provider.name,
    'voucher_masked_code', '••••' || v_voucher.code_last4,
    'voucher_remaining_grosz', v_remaining,
    'voucher_fully_paid', v_due = 0
  );
end;
$$;

revoke all on function public.submit_cart_order_v3(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v3(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text, text
) to service_role;

create or replace function public.sync_order_voucher_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemption public.voucher_redemptions;
  v_voucher public.gift_vouchers;
  v_now timestamptz := timezone('utc'::text, now());
  v_raw_code text;
  v_replacement_id uuid;
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    for v_redemption in
      select * from public.voucher_redemptions
      where order_id = new.id and status = 'reserved'
      for update
    loop
      update public.voucher_redemptions
      set status = 'committed', committed_at = v_now, updated_at = v_now
      where id = v_redemption.id;

      update public.payments
      set status = 'paid', paid_at = coalesce(paid_at, v_now), updated_at = v_now
      where order_id = new.id and provider = 'voucher'
        and provider_payment_id = v_redemption.id::text and status = 'pending';

      insert into public.voucher_provider_logs (
        provider_code, voucher_id, action, response_summary, success
      )
      select provider_code, id, 'commit',
        jsonb_build_object('order_id', new.id, 'redemption_id', v_redemption.id), true
      from public.gift_vouchers where id = v_redemption.voucher_id;
    end loop;
  end if;

  if new.status in ('cancelled', 'expired', 'refunded')
     and old.status is distinct from new.status then
    for v_redemption in
      select * from public.voucher_redemptions
      where order_id = new.id and status in ('reserved', 'committed')
      for update
    loop
      select * into v_voucher
      from public.gift_vouchers
      where id = v_redemption.voucher_id
      for update;

      if new.status in ('cancelled', 'expired') or v_voucher.refund_policy = 'restore' then
        update public.gift_vouchers
        set remaining_value_grosz = least(
              original_value_grosz,
              greatest(
                remaining_value_grosz + v_redemption.amount_grosz,
                coalesce((v_redemption.metadata ->> 'balance_before_grosz')::integer, 0)
              )
            ),
            status = case
              when v_voucher.status = 'cancelled' then 'cancelled'
              when least(
                v_voucher.original_value_grosz,
                greatest(
                  v_voucher.remaining_value_grosz + v_redemption.amount_grosz,
                  coalesce((v_redemption.metadata ->> 'balance_before_grosz')::integer, 0)
                )
              ) >= v_voucher.original_value_grosz then 'active'
              else 'partially_redeemed'
            end,
            updated_at = v_now
        where id = v_voucher.id;
      else
        v_raw_code := 'CN-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
        insert into public.gift_vouchers (
          provider_code, code_hash, code_last4, voucher_type, description,
          original_value_grosz, remaining_value_grosz, currency,
          valid_from, valid_until, status, multi_use,
          allowed_workshop_types, allowed_workshop_ids,
          refund_policy, metadata
        ) values (
          'ceramika_nero', public.voucher_code_hash(v_raw_code), right(v_raw_code, 4),
          v_voucher.voucher_type, 'Bon zastępczy po zwrocie zamówienia',
          v_redemption.amount_grosz, v_redemption.amount_grosz, v_voucher.currency,
          v_now, v_now + interval '1 year', 'active', true,
          v_voucher.allowed_workshop_types, v_voucher.allowed_workshop_ids,
          'restore',
          jsonb_build_object(
            'replacement_for_voucher_id', v_voucher.id,
            'replacement_for_order_id', new.id
          )
        ) returning id into v_replacement_id;

        insert into public.voucher_issue_secrets (voucher_id, raw_code, reason)
        values (v_replacement_id, v_raw_code, 'refund_replacement');
      end if;

      update public.voucher_redemptions
      set status = case when new.status = 'refunded' then 'refunded' else 'released' end,
          released_at = case when new.status <> 'refunded' then v_now else released_at end,
          refunded_at = case when new.status = 'refunded' then v_now else refunded_at end,
          updated_at = v_now
      where id = v_redemption.id;

      update public.payments
      set status = case when new.status = 'refunded' then 'refunded' else 'cancelled' end,
          refunded_amount_grosz = case
            when new.status = 'refunded' then amount_gross_grosz
            else refunded_amount_grosz
          end,
          updated_at = v_now
      where order_id = new.id and provider = 'voucher'
        and provider_payment_id = v_redemption.id::text;

      insert into public.voucher_provider_logs (
        provider_code, voucher_id, action, response_summary, success
      ) values (
        v_voucher.provider_code, v_voucher.id,
        case when new.status = 'refunded' then 'refund' else 'release' end,
        jsonb_build_object(
          'order_id', new.id,
          'redemption_id', v_redemption.id,
          'order_status', new.status,
          'replacement_voucher_id', v_replacement_id
        ), true
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_order_voucher_lifecycle()
  from public, anon, authenticated;

create trigger trg_orders_sync_voucher_lifecycle
after update of payment_status, status on public.orders
for each row execute function public.sync_order_voucher_lifecycle();

create or replace function public.admin_issue_voucher(
  p_provider_code text,
  p_code text,
  p_description text,
  p_voucher_type text,
  p_original_value_grosz integer,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_multi_use boolean,
  p_allowed_workshop_types text[],
  p_allowed_workshop_ids uuid[],
  p_refund_policy text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code text;
  v_generated boolean;
  v_id uuid;
begin
  if p_original_value_grosz <= 0 then raise exception 'Voucher value must be positive'; end if;
  if not exists (
    select 1 from public.gift_voucher_providers
    where code = p_provider_code and is_active = true
  ) then raise exception 'Voucher provider is unavailable'; end if;

  v_generated := nullif(trim(coalesce(p_code, '')), '') is null;
  if v_generated and p_provider_code <> 'ceramika_nero' then
    raise exception 'External provider voucher code is required';
  end if;
  v_code := case
    when v_generated then 'CN-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))
    else trim(p_code)
  end;

  insert into public.gift_vouchers (
    provider_code, code_hash, code_last4, voucher_type, description,
    original_value_grosz, remaining_value_grosz,
    valid_from, valid_until, multi_use,
    allowed_workshop_types, allowed_workshop_ids, refund_policy
  ) values (
    p_provider_code,
    public.voucher_code_hash(v_code),
    right(regexp_replace(upper(trim(v_code)), '\s+', '', 'g'), 4),
    p_voucher_type,
    nullif(trim(coalesce(p_description, '')), ''),
    p_original_value_grosz,
    p_original_value_grosz,
    coalesce(p_valid_from, timezone('utc'::text, now())),
    p_valid_until,
    p_multi_use,
    coalesce(p_allowed_workshop_types, '{}'::text[]),
    coalesce(p_allowed_workshop_ids, '{}'::uuid[]),
    p_refund_policy
  ) returning id into v_id;

  if v_generated then
    insert into public.voucher_issue_secrets (voucher_id, raw_code, reason)
    values (v_id, v_code, 'admin_generated');
  end if;

  insert into public.voucher_provider_logs (
    provider_code, voucher_id, action, response_summary, success
  ) values (
    p_provider_code, v_id, 'import', jsonb_build_object('generated', v_generated), true
  );

  return jsonb_build_object('voucher_id', v_id, 'code', v_code, 'generated', v_generated);
end;
$$;

revoke all on function public.admin_issue_voucher(
  text, text, text, text, integer, timestamptz, timestamptz,
  boolean, text[], uuid[], text
) from public, anon, authenticated;
grant execute on function public.admin_issue_voucher(
  text, text, text, text, integer, timestamptz, timestamptz,
  boolean, text[], uuid[], text
) to service_role;

create or replace function public.admin_cancel_voucher(p_voucher_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1 from public.voucher_redemptions
    where voucher_id = p_voucher_id and status = 'reserved'
  ) then raise exception 'Voucher has an active reservation'; end if;
  update public.gift_vouchers
  set status = 'cancelled', cancelled_at = timezone('utc'::text, now())
  where id = p_voucher_id;
end;
$$;

create or replace function public.admin_extend_voucher(
  p_voucher_id uuid,
  p_valid_until timestamptz
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_valid_until <= timezone('utc'::text, now()) then
    raise exception 'New expiry must be in the future';
  end if;
  update public.gift_vouchers
  set valid_until = p_valid_until,
      status = case
        when status = 'expired' and remaining_value_grosz > 0 then
          case when remaining_value_grosz < original_value_grosz then 'partially_redeemed' else 'active' end
        else status
      end,
      updated_at = timezone('utc'::text, now())
  where id = p_voucher_id;
end;
$$;

revoke all on function public.admin_cancel_voucher(uuid) from public, anon, authenticated;
revoke all on function public.admin_extend_voucher(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_cancel_voucher(uuid) to service_role;
grant execute on function public.admin_extend_voucher(uuid, timestamptz) to service_role;

comment on table public.gift_vouchers is
  'Gift vouchers are payment instruments. Only a SHA-256 code hash and last four characters are stored.';
comment on table public.voucher_redemptions is
  'Atomic voucher reservations/commits linked to unified orders.';
comment on function public.submit_cart_order_v3 is
  'Creates the order and atomically applies a voucher, preserving Stripe or bank transfer only for the remaining amount.';
