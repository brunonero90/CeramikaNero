-- Ceramika Nero — same-event Glina do Wina glazing follow-up.
-- Apply after migration 31.

alter table public.workshops
  add column if not exists followup_included_in_price boolean not null default false;

alter table public.workshops
  drop constraint if exists workshops_followup_included_requires_offer_check;
alter table public.workshops
  add constraint workshops_followup_included_requires_offer_check
  check (not followup_included_in_price or offers_followup_session);

-- Glazing happens during any later Glina do Wina event. The visit is optional,
-- available from 14 days after the first session, has no artificial upper date
-- limit, reserves its own capacity and is included in the original price.
update public.workshops
set offers_followup_session = true,
    requires_followup_session = false,
    followup_workshop_id = null,
    followup_workshop_type = coalesce(
      nullif(trim(workshop_type), ''),
      slug
    ),
    followup_min_days = 14,
    followup_max_days = null,
    followup_included_in_price = true,
    updated_at = timezone('utc'::text, now())
where slug in ('glina-do-wina', 'glinadowina')
   or lower(trim(title)) = 'glina do wina';

comment on column public.workshops.followup_included_in_price is
  'When true, a validated linked follow-up reserves capacity but contributes zero to the order total.';

-- Preserve included pricing only while the same follow-up type remains enabled.
create or replace function public.set_workshop_operational_metadata_v2(
  p_workshop_id uuid,
  p_participant_audience text,
  p_collect_participant_age boolean,
  p_workshop_type text,
  p_offers_followup_session boolean,
  p_requires_followup_session boolean,
  p_followup_workshop_type text,
  p_followup_min_days integer,
  p_followup_max_days integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_offers boolean := coalesce(p_offers_followup_session, false)
    or coalesce(p_requires_followup_session, false);
  v_new_followup_type text := nullif(trim(coalesce(p_followup_workshop_type, '')), '');
begin
  update public.workshops
  set participant_audience = p_participant_audience,
      collect_participant_age = coalesce(p_collect_participant_age, false),
      workshop_type = nullif(trim(p_workshop_type), ''),
      offers_followup_session = v_offers,
      requires_followup_session = coalesce(p_requires_followup_session, false),
      followup_included_in_price = case
        when not v_offers then false
        when v_new_followup_type is distinct from followup_workshop_type then false
        else followup_included_in_price
      end,
      followup_workshop_id = case
        when not v_offers then null
        when v_new_followup_type is distinct from followup_workshop_type then null
        else followup_workshop_id
      end,
      followup_workshop_type = case when v_offers then v_new_followup_type else null end,
      followup_min_days = case when v_offers then p_followup_min_days else null end,
      followup_max_days = case when v_offers then p_followup_max_days else null end,
      updated_at = timezone('utc'::text, now())
  where id = p_workshop_id;

  if not found then raise exception 'Workshop not found'; end if;
end;
$$;

revoke all on function public.set_workshop_operational_metadata_v2(
  uuid, text, boolean, text, boolean, boolean, text, integer, integer
) from public, anon;
grant execute on function public.set_workshop_operational_metadata_v2(
  uuid, text, boolean, text, boolean, boolean, text, integer, integer
) to authenticated, service_role;

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
  v_reused boolean;
  v_included_line jsonb;
  v_included_session_id uuid;
  v_included_booking_id uuid;
  v_included_unit_price integer;
  v_included_line_total integer;
  v_included_reduction integer := 0;
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
  v_reused := coalesce((v_result ->> 'reused')::boolean, false);

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;
  if not found then
    raise exception 'Order not found after submission';
  end if;

  -- The public follow-up session can have its normal event price while the
  -- linked glazing visit is included in the primary workshop purchase. The
  -- relationship guard in submit_cart_order_v5 is the authority that permits
  -- this flag. Apply the price adjustment before voucher reservation in v3.
  if not v_reused then
    for v_included_line in
      select value
      from jsonb_array_elements(p_lines)
      where value->>'type' = 'workshop_session'
        and value->>'link_role' = 'followup'
        and coalesce((value->>'included_followup')::boolean, false)
    loop
      v_included_session_id := (v_included_line->>'session_id')::uuid;
      v_included_booking_id := null;
      v_included_unit_price := 0;
      v_included_line_total := 0;

      select oi.booking_id, oi.unit_price_gross_grosz, oi.line_total_gross_grosz
        into v_included_booking_id, v_included_unit_price, v_included_line_total
      from public.order_items oi
      where oi.order_id = v_order_id
        and oi.item_type = 'workshop_session'
        and oi.workshop_session_id = v_included_session_id
        and oi.line_total_gross_grosz > 0
      order by oi.id
      limit 1
      for update;

      if v_included_booking_id is null or coalesce(v_included_line_total, 0) <= 0 then
        continue;
      end if;

      update public.bookings
      set unit_price_gross_grosz = 0,
          total_price_gross_grosz = 0,
          updated_at = v_now
      where id = v_included_booking_id;

      update public.order_items
      set unit_price_gross_grosz = 0,
          line_total_gross_grosz = 0,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'included_followup', true,
            'original_unit_price_gross_grosz', v_included_unit_price,
            'original_line_total_gross_grosz', v_included_line_total
          )
      where order_id = v_order_id
        and booking_id = v_included_booking_id;

      update public.booking_events
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'included_followup', true,
            'unit_price_gross_grosz', 0,
            'original_unit_price_gross_grosz', v_included_unit_price
          )
      where booking_id = v_included_booking_id
        and event_type = 'reserved';

      v_included_reduction := v_included_reduction + v_included_line_total;
    end loop;

    if v_included_reduction > 0 then
      update public.orders
      set subtotal_gross_grosz = greatest(0, subtotal_gross_grosz - v_included_reduction),
          total_gross_grosz = greatest(0, total_gross_grosz - v_included_reduction),
          updated_at = v_now
      where id = v_order_id
      returning * into v_order;

      if v_payment_id is not null then
        update public.payments
        set amount_gross_grosz = greatest(0, amount_gross_grosz - v_included_reduction),
            updated_at = v_now
        where id = v_payment_id;
      end if;

      update public.order_events
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'total_gross_grosz', v_order.total_gross_grosz,
            'included_followup_reduction_grosz', v_included_reduction
          )
      where order_id = v_order_id
        and event_type = 'created';

      v_result := jsonb_set(
        v_result,
        '{total_gross_grosz}',
        to_jsonb(v_order.total_gross_grosz),
        true
      );
    end if;
  end if;

  if v_reused
     and v_order.selected_payment_method is not null
     and v_order.selected_payment_method not in (
       p_selected_payment_method,
       'voucher'
     )
  then
    raise exception 'Idempotency key belongs to a different payment method';
  end if;

  -- submit_cart_order returns the oldest payment on an idempotent replay.
  -- Voucher rows are intentionally older than the cash row so generic
  -- "latest payment" checkout queries continue to target Stripe/bank transfer.
  -- Resolve the cash row explicitly before mutating provider/status.
  if v_reused
     and v_order.selected_payment_method is distinct from 'voucher'
  then
    select p.id into v_payment_id
    from public.payments p
    where p.order_id = v_order_id
      and p.provider <> 'voucher'
    order by p.created_at asc, p.id asc
    limit 1
    for update;

    if not found then
      raise exception 'Cash payment row is missing for reused voucher order';
    end if;

    v_result := jsonb_set(
      v_result,
      '{payment_id}',
      to_jsonb(v_payment_id),
      true
    );
  end if;

  if v_order.selected_payment_method is distinct from 'voucher' then
    update public.orders
    set selected_payment_method = p_selected_payment_method,
        updated_at = v_now
    where id = v_order_id;

    if v_payment_id is not null then
      update public.payments
      set provider = case
            when p_selected_payment_method = 'stripe' then 'stripe'
            else 'bank_transfer'
          end,
          status = case
            when v_reused then status
            when p_selected_payment_method = 'stripe' then 'created'
            else 'pending'
          end,
          updated_at = v_now
      where id = v_payment_id
        and status in ('created', 'pending');
    end if;
  end if;

  if v_public_token is not null then
    insert into public.order_portal_token_recovery (
      order_id,
      public_lookup_token
    )
    values (
      v_order_id,
      v_public_token
    )
    on conflict (order_id) do nothing;
  else
    select nullif(t.public_lookup_token, '') into v_public_token
    from public.order_portal_token_recovery t
    where t.order_id = v_order_id;

    if v_public_token is not null then
      v_result := jsonb_set(
        v_result,
        '{public_lookup_token}',
        to_jsonb(v_public_token),
        true
      );
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.submit_cart_order_v2(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text
) from public, anon, authenticated;

grant execute on function public.submit_cart_order_v2(
  text, text, text, text, text, text, boolean, timestamptz, text,
  jsonb, jsonb, text, text
) to service_role;

comment on function public.submit_cart_order_v2 is
  'Applies validated included follow-up pricing before vouchers and preserves mixed-payment replay selection.';


create or replace function public.submit_cart_order_v5(
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
  v_now timestamptz := timezone('utc'::text, now());
  v_sid uuid;
  v_line jsonb;
  v_followup_line jsonb;
  v_primary_session public.workshop_sessions;
  v_primary_workshop public.workshops;
  v_followup_session public.workshop_sessions;
  v_followup_workshop public.workshops;
  v_followup_count integer;
  v_quantity integer;
  v_expected_type text;
  v_included_requested boolean;
  v_min_start timestamptz;
  v_max_start timestamptz;
  v_result jsonb;
  v_order_id uuid;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Cart lines must be an array';
  end if;

  -- Lock every workshop session once, in UUID order, before checking any pair.
  for v_sid in
    select distinct (elem->>'session_id')::uuid
    from jsonb_array_elements(p_lines) elem
    where elem->>'type' = 'workshop_session'
      and nullif(elem->>'session_id', '') is not null
    order by 1
  loop
    perform 1
    from public.workshop_sessions
    where id = v_sid
    for update;
    if not found then raise exception 'Session not found'; end if;
  end loop;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and coalesce(value->>'link_role', 'primary') <> 'followup'
  loop
    select * into v_primary_session
    from public.workshop_sessions
    where id = (v_line->>'session_id')::uuid;

    select * into v_primary_workshop
    from public.workshops
    where id = v_primary_session.workshop_id;

    if not (v_primary_workshop.offers_followup_session or v_primary_workshop.requires_followup_session) then
      continue;
    end if;

    select count(*) into v_followup_count
    from jsonb_array_elements(p_lines) candidate
    where candidate->>'type' = 'workshop_session'
      and candidate->>'link_role' = 'followup'
      and candidate->>'linked_primary_session_id' = v_primary_session.id::text;

    if v_followup_count > 1 then
      raise exception 'Follow-up session may be selected at most once';
    end if;

    if v_followup_count = 0 then
      if v_primary_workshop.requires_followup_session then
        raise exception 'Follow-up session is required exactly once';
      end if;
      continue;
    end if;

    select value into v_followup_line
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and value->>'link_role' = 'followup'
      and value->>'linked_primary_session_id' = v_primary_session.id::text
    limit 1;

    if (v_followup_line->>'session_id')::uuid = v_primary_session.id then
      raise exception 'Follow-up session must differ from the primary session';
    end if;

    v_quantity := coalesce((v_line->>'quantity')::integer, 0);
    if coalesce((v_followup_line->>'quantity')::integer, 0) <> v_quantity then
      raise exception 'Follow-up quantity must match the primary quantity';
    end if;

    select * into v_followup_session
    from public.workshop_sessions
    where id = (v_followup_line->>'session_id')::uuid;

    select * into v_followup_workshop
    from public.workshops
    where id = v_followup_session.workshop_id;

    if v_primary_workshop.followup_workshop_id is not null then
      if v_followup_workshop.id <> v_primary_workshop.followup_workshop_id then
        raise exception 'Follow-up session does not match the configured workshop';
      end if;
    else
      v_expected_type := nullif(trim(v_primary_workshop.followup_workshop_type), '');
      if v_expected_type is null
         or (
           v_followup_workshop.workshop_type is distinct from v_expected_type
           and v_followup_workshop.slug is distinct from v_expected_type
         ) then
        raise exception 'Follow-up session does not match the configured workshop type';
      end if;
    end if;

    v_included_requested := coalesce(
      (v_followup_line->>'included_followup')::boolean,
      false
    );
    if v_included_requested is distinct from
       coalesce(v_primary_workshop.followup_included_in_price, false) then
      raise exception 'Follow-up price mode does not match workshop configuration';
    end if;

    v_min_start := v_primary_session.starts_at
      + make_interval(days => coalesce(v_primary_workshop.followup_min_days, 0));
    v_max_start := case
      when v_primary_workshop.followup_max_days is null then null
      else v_primary_session.starts_at
        + make_interval(days => v_primary_workshop.followup_max_days)
    end;

    if v_followup_session.starts_at < v_min_start
       or (v_max_start is not null and v_followup_session.starts_at > v_max_start) then
      raise exception 'Follow-up session is outside the configured date window';
    end if;

    if v_followup_workshop.status <> 'published'
       or v_followup_workshop.archived_at is not null
       or v_followup_workshop.booking_mode <> 'scheduled'
       or v_followup_session.status not in ('scheduled', 'sold_out')
       or v_followup_session.starts_at <= v_now
       or (
         v_followup_session.booking_opens_at is not null
         and v_followup_session.booking_opens_at > v_now
       )
       or (
         v_followup_session.booking_closes_at is not null
         and v_followup_session.booking_closes_at < v_now
       )
       or v_followup_session.capacity - v_followup_session.reserved_count < v_quantity then
      raise exception 'Follow-up session is no longer available';
    end if;
  end loop;

  -- Reject orphan/forged follow-up lines even though this RPC is service-only.
  for v_line in
    select value
    from jsonb_array_elements(p_lines)
    where value->>'type' = 'workshop_session'
      and value->>'link_role' = 'followup'
  loop
    select count(*) into v_followup_count
    from jsonb_array_elements(p_lines) primary_line
    join public.workshop_sessions primary_session
      on primary_session.id = nullif(primary_line->>'session_id', '')::uuid
    join public.workshops primary_workshop
      on primary_workshop.id = primary_session.workshop_id
    where primary_line->>'type' = 'workshop_session'
      and coalesce(primary_line->>'link_role', 'primary') <> 'followup'
      and primary_line->>'session_id' = v_line->>'linked_primary_session_id'
      and (primary_workshop.offers_followup_session or primary_workshop.requires_followup_session);

    if v_followup_count <> 1 then
      raise exception 'Follow-up session has no configured primary workshop';
    end if;
  end loop;

  v_result := public.submit_cart_order_v4(
    p_idempotency_key,
    p_customer_email,
    p_customer_first_name,
    p_customer_last_name,
    p_customer_phone,
    p_customer_notes,
    p_marketing_consent,
    p_terms_accepted_at,
    p_privacy_policy_version,
    p_lines,
    p_shipping_address,
    p_source,
    p_selected_payment_method,
    p_voucher_code
  );

  v_order_id := (v_result->>'order_id')::uuid;
  update public.booking_links bl
  set relationship = 'optional_followup'
  from public.bookings primary_booking
  join public.workshop_sessions primary_session
    on primary_session.id = primary_booking.workshop_session_id
  join public.workshops primary_workshop
    on primary_workshop.id = primary_session.workshop_id
  where bl.order_id = v_order_id
    and bl.primary_booking_id = primary_booking.id
    and not primary_workshop.requires_followup_session;

  update public.booking_events event
  set metadata = jsonb_set(
        coalesce(event.metadata, '{}'::jsonb),
        '{relationship}',
        to_jsonb('optional_followup'::text),
        true
      )
  from public.bookings booking
  join public.booking_links link
    on link.primary_booking_id = booking.id
  where booking.order_id = v_order_id
    and event.booking_id = booking.id
    and event.event_type = 'linked'
    and link.relationship = 'optional_followup';

  return v_result;
end;
$$;

revoke all on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) from public, anon, authenticated;
grant execute on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) to service_role;

comment on function public.submit_cart_order_v5(
  text, text, text, text, text, text, boolean, timestamptz,
  text, jsonb, jsonb, text, text, text
) is
  'Locks and validates optional/required follow-ups, open-ended date windows and included-price mode before atomic checkout.';
