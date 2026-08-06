-- Keep voucher idempotency replays from rewriting the voucher ledger as the
-- selected cash provider. Apply after migration 24.

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
  'Selects the non-voucher payment row on idempotent mixed-payment replays and never regresses an existing cash payment status.';
