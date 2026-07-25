-- Seed Ptasie Radio workshop + verified archive sessions, and Glina Box products.
-- Idempotent upserts. Does not invent extra recurrence beyond archive evidence.

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

insert into public.products (
  sku, slug, title, short_description, description, product_type, status,
  price_gross_grosz, compare_at_price_gross_grosz, images,
  requires_shipping, allows_pickup, track_inventory, inventory_quantity,
  shipping_fee_mode, shipping_fee_gross_grosz, seo_title, seo_description
) values (
  'GLINA-BOX',
  'glina-box',
  'Glina Box — kurs lepienia z gliny (podstawka)',
  'Zestaw do lepienia w domu z gliną, narzędziami, instrukcją i filmem krok po kroku.',
  'Glina Box to ceramiczny zestaw do pracy w domu: miękka glina, podstawowe narzędzia, instrukcja oraz dostęp do filmu instruktażowego. Po wyschnięciu pracy możesz zamówić opcjonalne wypalenie i szkliwienie w pracowni (osobna usługa).',
  'physical_product',
  'published',
  22900,
  22900,
  '[{"src":"/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg","alt":"Glina Box"},{"src":"/images/wix-migrated/747d6f_3a7f8f99735746e78d72aac1681f6b85.jpg","alt":"Glina Box — zestaw"}]'::jsonb,
  true,
  true,
  false,
  0,
  'quote_required',
  null,
  'Glina Box | Ceramika Nero',
  'Zestaw do lepienia z gliny w domu z kursem krok po kroku. Dostawa lub odbiór w pracowni.'
)
on conflict (sku) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  description = excluded.description,
  price_gross_grosz = excluded.price_gross_grosz,
  status = 'published',
  requires_shipping = true,
  allows_pickup = true,
  shipping_fee_mode = 'quote_required',
  images = excluded.images,
  updated_at = timezone('utc'::text, now()),
  archived_at = null;

insert into public.products (
  sku, slug, title, short_description, description, product_type, status,
  price_gross_grosz, compare_at_price_gross_grosz, images,
  requires_shipping, allows_pickup, track_inventory, inventory_quantity,
  shipping_fee_mode, seo_title, seo_description
) values (
  'SZKLIWIENIE-PRACOWNIA',
  'szkliwienie-prac-w-pracowni',
  'Szkliwienie i wypał prac w pracowni Ceramika Nero',
  'Opcjonalne profesjonalne szkliwienie i wypał wyschniętej pracy z Glina Box.',
  'Usługa pracowni: wypał i szkliwienie pracy wykonanej w domu. Nie jest wliczona w cenę Glina Box. Czas realizacji zgodny z informacją na stronie produktu (ok. 2 tygodnie po otrzymaniu pracy).',
  'studio_service',
  'published',
  6900,
  null,
  '[{"src":"/images/wix-migrated/747d6f_3cc1afd6652c406a8a85ad97d73c8c81.jpg","alt":"Szkliwienie prac w pracowni"}]'::jsonb,
  false,
  true,
  false,
  0,
  'quote_required',
  'Szkliwienie prac | Ceramika Nero',
  'Profesjonalne szkliwienie i wypał prac ceramicznych w pracowni Ceramika Nero.'
)
on conflict (sku) do update set
  title = excluded.title,
  short_description = excluded.short_description,
  description = excluded.description,
  price_gross_grosz = 6900,
  status = 'published',
  images = excluded.images,
  updated_at = timezone('utc'::text, now()),
  archived_at = null;

-- ---------------------------------------------------------------------------
-- Ptasie Radio workshop
-- ---------------------------------------------------------------------------

do $$
declare
  v_category_id uuid;
  v_instructor_id uuid;
  v_workshop_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
  v_slot record;
begin
  select id into v_category_id
  from public.workshop_categories
  where slug = 'glina-do-wina'
  limit 1;

  if v_category_id is null then
    select id into v_category_id
    from public.workshop_categories
    where slug <> 'smoke-test-category'
    order by display_order
    limit 1;
  end if;

  if v_category_id is null then
    raise exception 'No workshop category available for Ptasie Radio seed';
  end if;

  select id into v_instructor_id
  from public.instructors
  where is_active = true
  order by display_order, created_at
  limit 1;

  insert into public.workshops (
    category_id, title, slug, short_description, description, practical_information,
    minimum_age, maximum_age, default_duration_minutes, default_capacity,
    default_price_gross_grosz, currency, suggested_theme, booking_mode, status,
    is_featured, seo_title, seo_description
  ) values (
    v_category_id,
    'Glina do wina w Poznaniu w Ptasim Radiu',
    'glina-do-wina-w-poznaniu-w-ptasim-radiu',
    'Warsztaty ceramiczne w kawiarni Ptasie Radio w Poznaniu.',
    'Zapraszamy na relaksujący wieczór z ceramiką w kawiarni Ptasie Radio. Tworzysz własne przedmioty z gliny lub malujesz gotową ceramikę, delektując się chwilą przy winie, kawie lub herbacie.',
    'Lokalizacja: Ptasie Radio, ul. Kościuszki 74/3, 60-142 Poznań. Czas trwania: 90 minut.',
    18,
    null,
    90,
    12,
    18900,
    'PLN',
    'atelier',
    'scheduled',
    'published',
    true,
    'Glina do wina — Ptasie Radio Poznań | Ceramika Nero',
    'Warsztaty Glina do wina w Ptasim Radiu, ul. Kościuszki 74/3, Poznań.'
  )
  on conflict (slug) do update set
    title = excluded.title,
    short_description = excluded.short_description,
    description = excluded.description,
    practical_information = excluded.practical_information,
    default_duration_minutes = 90,
    default_price_gross_grosz = 18900,
    default_capacity = 12,
    booking_mode = 'scheduled',
    status = 'published',
    is_featured = true,
    archived_at = null,
    updated_at = timezone('utc'::text, now())
  returning id into v_workshop_id;

  if v_instructor_id is not null then
    insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
    values (v_workshop_id, v_instructor_id, 0)
    on conflict do nothing;
  end if;

  -- Archive-verified sessions (Europe/Warsaw local times → timestamptz)
  for v_slot in
    select * from (values
      (timestamptz '2026-07-30 18:30:00+02'),
      (timestamptz '2026-08-13 18:30:00+02'),
      (timestamptz '2026-08-27 18:30:00+02'),
      (timestamptz '2026-09-10 18:30:00+02')
    ) as t(starts_at)
  loop
    v_starts := v_slot.starts_at;
    v_ends := v_starts + interval '90 minutes';

    if exists (
      select 1 from public.workshop_sessions
      where workshop_id = v_workshop_id
        and starts_at = v_starts
    ) then
      update public.workshop_sessions
      set
        ends_at = v_ends,
        capacity = 12,
        price_gross_grosz = 18900,
        location_name = 'Ptasie Radio',
        location_address = 'ul. Kościuszki 74/3, 60-142 Poznań',
        venue_key = 'ptasie-radio',
        status = case when status = 'cancelled' then status else 'scheduled' end,
        timezone = 'Europe/Warsaw',
        instructor_id = coalesce(instructor_id, v_instructor_id),
        updated_at = timezone('utc'::text, now())
      where workshop_id = v_workshop_id
        and starts_at = v_starts;
    else
      insert into public.workshop_sessions (
        workshop_id, instructor_id, starts_at, ends_at, timezone, capacity,
        reserved_count, price_gross_grosz, currency, location_name, location_address,
        venue_key, status
      ) values (
        v_workshop_id, v_instructor_id, v_starts, v_ends, 'Europe/Warsaw', 12,
        0, 18900, 'PLN', 'Ptasie Radio', 'ul. Kościuszki 74/3, 60-142 Poznań',
        'ptasie-radio', 'scheduled'
      );
    end if;
  end loop;
end;
$$;
