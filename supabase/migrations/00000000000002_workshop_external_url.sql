-- Ceramika Nero — Phase 4 workshop external booking URL
--
-- Adds an optional external_booking_url column to workshops so that workshops
-- with booking_mode = 'external' can store a dedicated link. This is a
-- non-destructive additive change and does not drop any existing data.

alter table public.workshops
add column if not exists external_booking_url text;

comment on column public.workshops.external_booking_url is
  'Optional external booking link used when booking_mode = ''external''. Must use http or https.';
