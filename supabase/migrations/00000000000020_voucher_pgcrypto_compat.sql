-- Supabase and the PGlite migration harness install pgcrypto in `extensions`.
-- Voucher migrations use explicit, service-only public wrappers so function
-- search_path settings cannot accidentally resolve a different implementation.
-- This file sorts after migration 20 and before migration 21.

create or replace function public.digest(p_value text, p_algorithm text)
returns bytea
language sql
immutable
strict
set search_path = pg_catalog, extensions
as $$
  select extensions.digest(p_value, p_algorithm)
$$;

create or replace function public.gen_random_bytes(p_length integer)
returns bytea
language sql
volatile
strict
set search_path = pg_catalog, extensions
as $$
  select extensions.gen_random_bytes(p_length)
$$;

revoke all on function public.digest(text, text) from public, anon, authenticated;
revoke all on function public.gen_random_bytes(integer) from public, anon, authenticated;
grant execute on function public.digest(text, text) to service_role;
grant execute on function public.gen_random_bytes(integer) to service_role;

comment on function public.digest(text, text) is
  'Service-only compatibility wrapper for extensions.digest used by gift voucher hashing.';
comment on function public.gen_random_bytes(integer) is
  'Service-only compatibility wrapper for extensions.gen_random_bytes used by gift voucher code generation.';
