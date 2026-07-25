-- Ceramika Nero — clearly marked smoke-test operational data.
-- Safe to delete via slug prefix smoke-test- / title prefix [SMOKE-TEST].

insert into public.workshop_categories (name, slug, description, suggested_theme, display_order, is_visible)
values (
  '[SMOKE-TEST] Kategoria',
  'smoke-test-category',
  'Kategoria testowa go-live — do usunięcia po weryfikacji.',
  'atelier',
  999,
  true
)
on conflict (slug) do update set name = excluded.name;

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, seo_title, seo_description
)
select
  c.id,
  '[SMOKE-TEST] Ceramika dla dorosłych',
  'smoke-test-ceramika-dla-doroslych',
  'Sesja testowa go-live — nie jest ofertą publiczną studia.',
  'Warsztat testowy używany wyłącznie do weryfikacji kalendarza i rezerwacji. Usunąć po smoke teście.',
  'Dane testowe. Nie używać jako prawdziwej oferty.',
  18, null, 120, 6, 9900,
  'scheduled', 'published', false, 'atelier',
  '[SMOKE-TEST] Ceramika dla dorosłych',
  'Sesja testowa go-live Ceramika Nero.'
from public.workshop_categories c
where c.slug = 'smoke-test-category'
on conflict (slug) do update set
  title = excluded.title,
  status = 'published',
  archived_at = null,
  booking_mode = 'scheduled',
  default_price_gross_grosz = excluded.default_price_gross_grosz,
  default_capacity = excluded.default_capacity;

-- One future session (14 days ahead, 18:00 Europe/Warsaw approximated via timestamptz)
insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count,
  price_gross_grosz, currency, location_name, location_address, status
)
select
  w.id,
  (date_trunc('day', timezone('Europe/Warsaw', now())) + interval '14 days' + interval '18 hours')
    at time zone 'Europe/Warsaw',
  (date_trunc('day', timezone('Europe/Warsaw', now())) + interval '14 days' + interval '20 hours')
    at time zone 'Europe/Warsaw',
  'Europe/Warsaw',
  6,
  0,
  9900,
  'PLN',
  'Suchy Las (SMOKE-TEST)',
  'ul. Podgórna 3, Suchy Las',
  'scheduled'
from public.workshops w
where w.slug = 'smoke-test-ceramika-dla-doroslych'
  and not exists (
    select 1
    from public.workshop_sessions s
    where s.workshop_id = w.id
      and s.location_name = 'Suchy Las (SMOKE-TEST)'
      and s.status = 'scheduled'
      and s.starts_at > now()
  );
