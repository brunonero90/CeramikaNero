-- Voucher-only refund compatibility and zero-cash payment normalization.
-- Apply after migration 21.

create or replace function public.normalize_voucher_only_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.selected_payment_method = 'voucher'
     and new.voucher_applied_grosz > 0
     and new.total_gross_grosz = 0
  then
    update public.payments
    set amount_gross_grosz = 0,
        updated_at = timezone('utc'::text, now())
    where order_id = new.id
      and provider = 'voucher'
      and status = 'paid';
  end if;
  return new;
end;
$$;

revoke all on function public.normalize_voucher_only_payment()
  from public, anon, authenticated;

create trigger trg_orders_normalize_voucher_only_payment
after update of selected_payment_method, voucher_applied_grosz, total_gross_grosz
on public.orders
for each row execute function public.normalize_voucher_only_payment();

create or replace function public.refund_voucher_only_order(
  p_order_id uuid,
  p_reason text,
  p_operation_key text,
  p_actor_id uuid,
  p_actor_role text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.orders;
  v_redemption public.voucher_redemptions;
  v_release jsonb;
  v_now timestamptz := timezone('utc'::text, now());
begin
  if nullif(trim(p_operation_key), '') is null then
    raise exception 'Refund operation key is required';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Refund reason is required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  if v_order.selected_payment_method <> 'voucher'
     or v_order.payment_status <> 'paid'
     or v_order.status <> 'confirmed'
  then
    if v_order.status = 'refunded' then
      return jsonb_build_object('status', 'refunded', 'already_refunded', true);
    end if;
    raise exception 'Order is not a refundable voucher-only order';
  end if;
  if v_order.fulfillment_status <> 'unfulfilled' then
    raise exception 'Fulfilled orders require a manual return decision';
  end if;

  select * into v_redemption
  from public.voucher_redemptions
  where order_id = p_order_id and status = 'committed'
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'Committed voucher redemption not found'; end if;

  if exists (
    select 1 from public.order_events
    where order_id = p_order_id
      and event_type = 'voucher_refund_completed'
      and metadata ->> 'operation_key' = p_operation_key
  ) then
    return jsonb_build_object(
      'status', 'refunded',
      'already_recorded', true,
      'voucher_amount_grosz', v_redemption.amount_grosz
    );
  end if;

  update public.payments
  set status = 'refunded',
      refunded_amount_grosz = amount_gross_grosz,
      refund_reason = left(p_reason, 1000),
      updated_at = v_now
  where order_id = p_order_id
    and provider = 'voucher'
    and provider_payment_id = v_redemption.id::text;

  v_release := public.release_refunded_order_resources(
    p_order_id,
    p_operation_key
  );

  if coalesce((v_release ->> 'requires_manual_resolution')::boolean, false) then
    raise exception 'Voucher order resources require manual resolution';
  end if;

  insert into public.order_events (
    order_id, event_type, actor_type, actor_id, metadata
  ) values (
    p_order_id,
    'voucher_refund_completed',
    'admin',
    p_actor_id,
    jsonb_build_object(
      'actor_role', p_actor_role,
      'operation_key', p_operation_key,
      'voucher_redemption_id', v_redemption.id,
      'voucher_amount_grosz', v_redemption.amount_grosz,
      'has_reason', true,
      'resources', v_release
    )
  );

  return jsonb_build_object(
    'status', 'refunded',
    'voucher_amount_grosz', v_redemption.amount_grosz,
    'resources', v_release
  );
end;
$$;

revoke all on function public.refund_voucher_only_order(
  uuid, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.refund_voucher_only_order(
  uuid, text, text, uuid, text
) to service_role;

comment on function public.refund_voucher_only_order is
  'Refunds a fully voucher-paid order, releases capacity and lets the voucher lifecycle restore or replace the redeemed value.';
