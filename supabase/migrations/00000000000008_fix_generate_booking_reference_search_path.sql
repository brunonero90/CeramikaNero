-- Ceramika Nero — Phase 5 follow-up fix (3)
--
-- The trigger function public.generate_booking_reference was created in
-- 00000000000000_initial_schema.sql with an unqualified gen_random_bytes call.
-- When fired from public.begin_booking (which sets search_path = public), the
-- active search path does not include the extensions schema where pgcrypto lives,
-- so the trigger fails at runtime.
--
-- This migration recreates the trigger function with explicit schema-qualified
-- pgcrypto calls so it executes correctly regardless of the caller's search path.
-- All other behaviour is preserved.
--
-- This is a forward-only, additive migration. No data is modified.

-- Recreate generate_booking_reference with schema-qualified pgcrypto calls.
create or replace function public.generate_booking_reference()
returns trigger
language plpgsql
as $$
declare
  prefix text;
  suffix text;
  reference text;
  exists_count integer;
begin
  if NEW.booking_reference is not null then
    return NEW;
  end if;
  prefix := 'CN-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-';
  loop
    suffix := upper(substring(encode(extensions.gen_random_bytes(3), 'hex'), 1, 4));
    reference := prefix || suffix;
    select count(*) into exists_count from public.bookings where booking_reference = reference;
    if exists_count = 0 then
      NEW.booking_reference := reference;
      return NEW;
    end if;
  end loop;
end;
$$;

comment on function public.generate_booking_reference() is
  'Trigger function that creates a short, human-readable booking reference such as CN-20260723-A3F1 before insert.';

-- Re-apply least-privilege grants for the recreated function.
revoke execute on function public.generate_booking_reference() from public, anon, authenticated;
grant execute on function public.generate_booking_reference() to service_role;
