-- Keep the voucher payment ledger synchronized directly from redemption state.
-- Apply after migration 23. The order lifecycle trigger remains authoritative
-- for voucher balance and order/booking resources; this trigger closes the
-- payment-ledger boundary even when a provider reference cannot be matched.

create or replace function public.sync_voucher_payment_from_redemption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc'::text, now());
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'committed' then
    update public.payments
    set status = 'paid',
        paid_at = coalesce(paid_at, v_now),
        failure_code = null,
        failure_message = null,
        updated_at = v_now
    where order_id = new.order_id
      and provider = 'voucher'
      and status = 'pending';
  elsif new.status = 'released' then
    update public.payments
    set status = 'cancelled',
        updated_at = v_now
    where order_id = new.order_id
      and provider = 'voucher'
      and status in ('created', 'pending', 'failed');
  elsif new.status = 'refunded' then
    update public.payments
    set status = 'refunded',
        refunded_amount_grosz = amount_gross_grosz,
        updated_at = v_now
    where order_id = new.order_id
      and provider = 'voucher'
      and status in ('created', 'pending', 'paid', 'partially_refunded');
  end if;

  return new;
end;
$$;

revoke all on function public.sync_voucher_payment_from_redemption()
  from public, anon, authenticated;

create trigger trg_voucher_redemptions_sync_payment
after update of status on public.voucher_redemptions
for each row execute function public.sync_voucher_payment_from_redemption();

comment on function public.sync_voucher_payment_from_redemption is
  'Synchronizes the voucher payment ledger from redemption lifecycle changes using the one-voucher-per-order invariant.';
