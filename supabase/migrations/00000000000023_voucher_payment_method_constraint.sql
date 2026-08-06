-- Allow fully voucher-paid orders to identify their payment method explicitly.
-- Apply after migrations 21 and 22.

alter table public.orders
  drop constraint if exists orders_selected_payment_method_check;

alter table public.orders
  add constraint orders_selected_payment_method_check
  check (
    selected_payment_method is null
    or selected_payment_method in ('stripe', 'bank_transfer', 'voucher')
  );

comment on column public.orders.selected_payment_method is
  'Customer-selected payment method. Voucher is used when no cash remainder is due.';
