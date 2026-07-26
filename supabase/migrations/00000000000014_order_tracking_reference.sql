-- Ceramika Nero — optional shipping tracking reference on orders.
-- Additive. Does not rewrite migrations 11–13.
-- Rollback: alter table public.orders drop column if exists tracking_reference;

alter table public.orders
  add column if not exists tracking_reference text;

comment on column public.orders.tracking_reference is
  'Optional carrier tracking reference for shipped product orders; never invent values.';
