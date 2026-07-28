-- Ceramika Nero — development seed data
-- These records represent the current studio offer using provisional prices and
-- schedules where exact information is not confirmed. They are suitable for
-- local development and UI testing only.

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

insert into public.workshop_categories (name, slug, description, suggested_theme, display_order, is_visible)
values
  ('Dla dzieci', 'dla-dzieci', 'Warsztaty ceramiczne dla najmłodszych artystów.', 'joyful', 10, true),
  ('Dla dorosłych', 'dla-doroslych', 'Warsztaty i kursy ceramiczne dla dorosłych.', 'atelier', 20, true),
  ('Rodzinne', 'rodzinne', 'Wspólne tworzenie dla rodziców i dzieci.', 'joyful', 30, true),
  ('Glina do wina', 'glina-do-wina', 'Wieczorne warsztaty ceramiczne z lampką wina.', 'atelier', 40, true),
  ('Urodziny', 'urodziny', 'Urodzinowe warsztaty ceramiczne dla dzieci i dorosłych.', 'joyful', 50, true),
  ('Grupy i firmy', 'grupy-i-firmy', 'Warsztaty integracyjne dla grup i firm.', 'atelier', 60, true),
  ('Wieczory panieńskie', 'wieczory-panienskie', 'Kreatywne spotkania dla przyszłej panny młodej i gości.', 'joyful', 70, true),
  ('Półkolonie i wydarzenia', 'polkolonie-i-wydarzenia', 'Półkolonie oraz sezonowe wydarzenia ceramiczne.', 'joyful', 80, true);

-- ---------------------------------------------------------------------------
-- Instructors
-- ---------------------------------------------------------------------------

insert into public.instructors (display_name, slug, biography, is_active, display_order)
values
  ('Ania Nero', 'ania-nero', 'Założycielka pracowni Ceramika Nero. Instruktorka ceramiki i pedagog.', true, 10),
  ('Kasia Nero', 'kasia-nero', 'Specjalistka od pracy z dziećmi oraz warsztatów rodzinnych.', true, 20);

-- ---------------------------------------------------------------------------
-- Media placeholders (no real files uploaded in this phase)
-- ---------------------------------------------------------------------------

insert into public.media_assets (original_filename, storage_bucket, storage_path, mime_type, alt_text, source)
values
  ('placeholders/ceramika-dla-doroslych.jpg', 'public', 'placeholders/ceramika-dla-doroslych.jpg', 'image/jpeg', 'Ceramika dla dorosłych w pracowni', 'generated'),
  ('placeholders/glina-do-wina.jpg', 'public', 'placeholders/glina-do-wina.jpg', 'image/jpeg', 'Glina do wina', 'generated'),
  ('placeholders/dla-dzieci.jpg', 'public', 'placeholders/dla-dzieci.jpg', 'image/jpeg', 'Dzieci tworzą z gliny', 'generated'),
  ('placeholders/mlodziez.jpg', 'public', 'placeholders/mlodziez.jpg', 'image/jpeg', 'Kurs ceramiki dla młodzieży', 'generated'),
  ('placeholders/rysunek-architektura.jpg', 'public', 'placeholders/rysunek-architektura.jpg', 'image/jpeg', 'Rysunek i architektura', 'generated'),
  ('placeholders/rodzinne.jpg', 'public', 'placeholders/rodzinne.jpg', 'image/jpeg', 'Rodzinne warsztaty ceramiczne', 'generated'),
  ('placeholders/urodziny.jpg', 'public', 'placeholders/urodziny.jpg', 'image/jpeg', 'Urodziny ceramiczne', 'generated'),
  ('placeholders/firmy.jpg', 'public', 'placeholders/firmy.jpg', 'image/jpeg', 'Warsztaty dla firm', 'generated'),
  ('placeholders/pracownia.jpg', 'public', 'placeholders/pracownia.jpg', 'image/jpeg', 'Pracownia Ceramika Nero', 'generated'),
  ('placeholders/blog-1.jpg', 'public', 'placeholders/blog-1.jpg', 'image/jpeg', 'Warsztaty ceramiczne', 'generated'),
  ('placeholders/gallery-1.jpg', 'public', 'placeholders/gallery-1.jpg', 'image/jpeg', 'Wazon ceramiczny', 'generated'),
  ('placeholders/gallery-2.jpg', 'public', 'placeholders/gallery-2.jpg', 'image/jpeg', 'Misa z gliny', 'generated'),
  ('placeholders/gallery-3.jpg', 'public', 'placeholders/gallery-3.jpg', 'image/jpeg', 'Kubek ręcznie robiony', 'generated');

-- ---------------------------------------------------------------------------
-- Workshops
-- ---------------------------------------------------------------------------

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Ceramika dla dorosłych',
  'ceramika-dla-doroslych',
  'Wieczorne i weekendowe warsztaty ceramiczne dla dorosłych.',
  'Warsztaty obejmują podstawowe techniki pracy z gliną: wałkowanie, lepienie na kole, szkliwienie. Każdy uczestnik wykonuje własne naczynia, które są wypalane w pracowni.',
  'Materiały, narzędzia, farby i szkliwa są wliczone w cenę. Prace wypalamy i informujemy o terminie odbioru.',
  18, null, 150, 12, 18000,
  'scheduled', 'published', true, 'atelier',
  m.id,
  'Ceramika dla dorosłych w Suchym Lesie | Ceramika Nero',
  'Warsztaty ceramiczne dla dorosłych w pracowni Ceramika Nero w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'dla-doroslych' and m.storage_path = 'placeholders/ceramika-dla-doroslych.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Glina do wina',
  'glina-do-wina',
  'Wieczór z gliną i kieliszkiem wina dla dorosłych.',
  'Relaksujące spotkanie z gliną w kobiecej atmosferze. Tworzymy małe formy użytkowe, dekoracyjne lub biżuterię ceramiczną. Wino i przekąski są wliczone.',
  'Warsztat dla osób pełnoletnich. Napoje i przekąski w cenie. Prace wypalane i gotowe do odbioru w ciągu kilku dni.',
  18, null, 150, 14, 22000,
  'scheduled', 'published', true, 'atelier',
  m.id,
  'Glina do wina | Ceramika Nero',
  'Wieczorne warsztaty ceramiczne z lampką wina w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'glina-do-wina' and m.storage_path = 'placeholders/glina-do-wina.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Kurs rysunku, malarstwa i ceramiki 6–10 lat',
  'kurs-rysunku-malarstwa-ceramiki-6-10-lat',
  'Kreatywny kurs dla dzieci w wieku 6–10 lat.',
  'Kurs łączący rysunek, malarstwo i pracę z gliną. Dzieci uczą się podstaw kompozycji, koloru i formy, a także lepią własne prace ceramiczne.',
  'Wszystkie materiały są wliczone w cenę. Zajęcia prowadzone w małych grupach.',
  6, 10, 90, 10, 12000,
  'scheduled', 'published', false, 'joyful',
  m.id,
  'Kurs rysunku, malarstwa i ceramiki dla dzieci 6–10 lat | Ceramika Nero',
  'Kurs artystyczny dla dzieci w pracowni Ceramika Nero w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'dla-dzieci' and m.storage_path = 'placeholders/dla-dzieci.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Kurs ceramiki dla młodzieży 11+',
  'kurs-ceramiki-dla-mlodziezy-11',
  'Kurs ceramiczny dla młodzieży w wieku 11 lat i starszej.',
  'Kurs rozwijający techniki ceramiczne dla młodzieży: lepienie na kole, modelowanie, szkliwienie. Możliwość realizacji własnych projektów.',
  'Materiały i narzędzia w cenie. Prace są wypalane w pracowni.',
  11, null, 120, 10, 14000,
  'scheduled', 'published', false, 'joyful',
  m.id,
  'Kurs ceramiki dla młodzieży 11+ | Ceramika Nero',
  'Kurs ceramiczny dla młodzieży w pracowni Ceramika Nero.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'dla-dzieci' and m.storage_path = 'placeholders/mlodziez.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Rysunek i architektura 11+',
  'rysunek-i-architektura-11',
  'Kurs rysunku architektonicznego dla młodzieży 11+.',
  'Kurs rozwijający zdolności obserwacji, rysunku ołówkiem oraz podstaw projektowania architektonicznego.',
  'Materiały do rysunku w cenie. Zajęcia w małej grupie.',
  11, null, 90, 10, 11000,
  'scheduled', 'published', false, 'joyful',
  m.id,
  'Rysunek i architektura dla młodzieży 11+ | Ceramika Nero',
  'Kurs rysunku i architektury dla młodzieży w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'dla-dzieci' and m.storage_path = 'placeholders/rysunek-architektura.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Glina i rodzina',
  'glina-i-rodzina',
  'Wspólne warsztaty ceramiczne dla rodzin.',
  'Rodzinne spotkanie z gliną. Rodzice i dzieci tworzą razem, ucząc się od siebie i wspólnie projektując ceramiczne pamiątki.',
  'Warsztat dla rodzin z dziećmi od 4 lat. Materiały w cenie.',
  4, null, 120, 12, 16000,
  'scheduled', 'published', false, 'joyful',
  m.id,
  'Glina i rodzina | Ceramika Nero',
  'Rodzinne warsztaty ceramiczne w pracowni Ceramika Nero.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'rodzinne' and m.storage_path = 'placeholders/rodzinne.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Urodziny ceramiczne',
  'urodziny-ceramiczne',
  'Urodzinowe warsztaty ceramiczne dla dzieci i młodzieży.',
  'Organizujemy urodziny w pracowni ceramicznej. Dzieci biorą udział w warsztacie, dekorują tortownice, tworzą figurki lub malują gotowe formy.',
  'Warsztat dostosowany do wieku i liczby dzieci. Dekoracja sali, materiały i opieka instruktora wliczone.',
  4, null, 120, 15, 0,
  'enquiry', 'published', true, 'joyful',
  m.id,
  'Urodziny ceramiczne | Ceramika Nero',
  'Urodzinowe warsztaty ceramiczne dla dzieci w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'urodziny' and m.storage_path = 'placeholders/urodziny.jpg';

insert into public.workshops (
  category_id, title, slug, short_description, description, practical_information,
  minimum_age, maximum_age, default_duration_minutes, default_capacity, default_price_gross_grosz,
  booking_mode, status, is_featured, suggested_theme, featured_media_id, seo_title, seo_description
)
select
  c.id,
  'Warsztaty dla firm',
  'warsztaty-dla-firm',
  'Integracyjne warsztaty ceramiczne dla grup i firm.',
  'Warsztaty team-buildingowe w pracowni ceramicznej. Wspólne tworzenie z gliną, relaks i kreatywność poza biurem.',
  'Oferta dla grup od 8 osób. Dostosowujemy program, czas i catering do potrzeb firmy.',
  18, null, 180, 20, 0,
  'enquiry', 'published', true, 'atelier',
  m.id,
  'Warsztaty dla firm i grup | Ceramika Nero',
  'Integracyjne warsztaty ceramiczne dla firm w Suchym Lesie.'
from public.workshop_categories c
  cross join public.media_assets m
where c.slug = 'grupy-i-firmy' and m.storage_path = 'placeholders/firmy.jpg';

-- ---------------------------------------------------------------------------
-- Workshop instructors
-- ---------------------------------------------------------------------------

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'ceramika-dla-doroslych' and i.slug = 'ania-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'glina-do-wina' and i.slug = 'ania-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'kurs-rysunku-malarstwa-ceramiki-6-10-lat' and i.slug = 'kasia-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'kurs-ceramiki-dla-mlodziezy-11' and i.slug = 'kasia-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'rysunek-i-architektura-11' and i.slug = 'kasia-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'glina-i-rodzina' and i.slug = 'kasia-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'urodziny-ceramiczne' and i.slug = 'kasia-nero';

insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
select w.id, i.id, 10
from public.workshops w
  cross join public.instructors i
where w.slug = 'warsztaty-dla-firm' and i.slug = 'ania-nero';

-- ---------------------------------------------------------------------------
-- Workshop sessions (UTC times, Europe/Warsaw display timezone)
-- ---------------------------------------------------------------------------

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-05 17:00:00'::timestamptz), timezone('utc'::text, '2026-08-05 19:30:00'::timestamptz)),
      (timezone('utc'::text, '2026-08-12 17:00:00'::timestamptz), timezone('utc'::text, '2026-08-12 19:30:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'ceramika-dla-doroslych';

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-07 18:00:00'::timestamptz), timezone('utc'::text, '2026-08-07 20:30:00'::timestamptz)),
      (timezone('utc'::text, '2026-08-21 18:00:00'::timestamptz), timezone('utc'::text, '2026-08-21 20:30:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'glina-do-wina';

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-09 10:00:00'::timestamptz), timezone('utc'::text, '2026-08-09 11:30:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'kurs-rysunku-malarstwa-ceramiki-6-10-lat';

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-09 12:00:00'::timestamptz), timezone('utc'::text, '2026-08-09 14:00:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'kurs-ceramiki-dla-mlodziezy-11';

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-09 15:00:00'::timestamptz), timezone('utc'::text, '2026-08-09 16:30:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'rysunek-i-architektura-11';

insert into public.workshop_sessions (
  workshop_id, starts_at, ends_at, timezone, capacity, reserved_count, price_gross_grosz,
  location_name, location_address, status
)
select w.id, s.starts_at, s.ends_at, 'Europe/Warsaw', w.default_capacity, 0, w.default_price_gross_grosz,
       'Pracownia Ceramika Nero', 'Suchy Las, woj. wielkopolskie', 'scheduled'
from public.workshops w
  cross join lateral (
    values
      (timezone('utc'::text, '2026-08-16 10:00:00'::timestamptz), timezone('utc'::text, '2026-08-16 12:00:00'::timestamptz))
  ) as s(starts_at, ends_at)
where w.slug = 'glina-i-rodzina';

-- ---------------------------------------------------------------------------
-- Workshop media associations
-- ---------------------------------------------------------------------------

insert into public.workshop_media (workshop_id, media_asset_id, role, display_order)
select w.id, m.id, 'featured', 10
from public.workshops w
  cross join public.media_assets m
where w.slug = 'ceramika-dla-doroslych' and m.storage_path = 'placeholders/ceramika-dla-doroslych.jpg';

-- ---------------------------------------------------------------------------
-- Content pages
-- ---------------------------------------------------------------------------

insert into public.content_pages (title, slug, content, status, suggested_theme, seo_title, seo_description)
values
  ('Pracownia', 'pracownia', 'Pracownia Ceramika Nero w Suchym Lesie. Tworzymy i uczymy ceramiki w ciepłej, kameralnej atmosferze.', 'published', 'atelier', 'Pracownia Ceramika Nero w Suchym Lesie', 'Odwiedź pracownię ceramiczną Ceramika Nero w Suchym Lesie.'),
  ('Kontakt', 'kontakt', 'Skontaktuj się z nami: kontakt@ceramikanero.pl, Suchy Las.', 'published', 'atelier', 'Kontakt | Ceramika Nero', 'Skontaktuj się z pracownią Ceramika Nero.');

-- ---------------------------------------------------------------------------
-- Blog posts
-- ---------------------------------------------------------------------------

insert into public.blog_posts (title, slug, excerpt, content, status, author_name, published_at, seo_title, seo_description)
select
  'Pierwsze kroki w ceramice',
  'pierwsze-kroki-w-ceramice',
  'Co warto wiedzieć przed pierwszym warsztatem ceramicznym?',
  'Przed pierwszym spotkaniem z gliną warto założyć wygodne ubrania, które nie przeszkadzają, gdy się ubrudzą. Nie potrzebujesz żadnego doświadczenia — wszystkiego nauczysz się na miejscu.',
  'published',
  'Ania Nero',
  timezone('utc'::text, now()),
  'Pierwsze kroki w ceramice | Ceramika Nero',
  'Wskazówki dla osób, które chcą zacząć przygodę z ceramiką.'
from public.media_assets m
where m.storage_path = 'placeholders/blog-1.jpg';

-- ---------------------------------------------------------------------------
-- Gallery items
-- ---------------------------------------------------------------------------

insert into public.gallery_items (media_asset_id, title, description, category, display_order, is_visible)
select m.id, 'Wazon ceramiczny', 'Ręcznie lepiony wazon z białej gliny.', 'ceramika', 10, true
from public.media_assets m where m.storage_path = 'placeholders/gallery-1.jpg';

insert into public.gallery_items (media_asset_id, title, description, category, display_order, is_visible)
select m.id, 'Misa z gliny', 'Misa z ozdobnym szkliwem.', 'ceramika', 20, true
from public.media_assets m where m.storage_path = 'placeholders/gallery-2.jpg';

insert into public.gallery_items (media_asset_id, title, description, category, display_order, is_visible)
select m.id, 'Kubek ręcznie robiony', 'Kubek do kawy z motywem roślinnym.', 'ceramika', 30, true
from public.media_assets m where m.storage_path = 'placeholders/gallery-3.jpg';

-- ---------------------------------------------------------------------------
-- Site settings
-- ---------------------------------------------------------------------------

insert into public.site_settings (key, value, description)
values
  ('studio_name', '"Ceramika Nero"'::jsonb, 'Nazwa studia używana w metadanych i stopce.'),
  ('studio_address', '"Suchy Las, Polska"'::jsonb, 'Adres studia wyświetlany publicznie.'),
  ('studio_email', '"kontakt@ceramikanero.pl"'::jsonb, 'Publiczny adres e-mail studia.'),
  ('studio_phone', '"+48 TBD"'::jsonb, 'Publiczny numer telefonu (TBD).'),
  ('booking_cta_label', '"Zarezerwuj warsztat"'::jsonb, 'Tekst głównego przycisku rezerwacji.'),
  ('default_seo_title', '"Ceramika Nero — Warsztaty ceramiczne w Suchym Lesie"'::jsonb, 'Domyślny tytuł SEO.'),
  ('default_seo_description', '"Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w naszej pracowni w Suchym Lesie."'::jsonb, 'Domyślny opis SEO.');

-- ---------------------------------------------------------------------------
-- Legacy redirects
-- ---------------------------------------------------------------------------

insert into public.legacy_redirects (source_path, destination_path, status_code, notes)
values
  ('/product-page/ceramika-dla-doroslych', '/warsztaty/ceramika-dla-doroslych', 301, 'Przykładowe przekierowanie ze Wix'),
  ('/product-page/glina-do-wina', '/warsztaty/glina-do-wina', 301, 'Przykładowe przekierowanie ze Wix');
