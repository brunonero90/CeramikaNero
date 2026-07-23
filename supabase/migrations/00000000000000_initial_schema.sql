-- Ceramika Nero — initial database schema
-- Created in Phase 2. This migration establishes the production data foundation
-- for workshops, sessions, bookings, payments, content, media, and Wix redirects.

-- Enable pgcrypto for UUID generation.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Utility triggers
-- ---------------------------------------------------------------------------

-- Automatically set updated_at on every table that has the column.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

comment on function public.set_updated_at() is
  'Trigger function that sets updated_at to the current UTC timestamp before update.';

-- Generate a human-friendly booking reference without exposing sequential IDs.
create or replace function public.generate_booking_reference()
returns text as $$
declare
  prefix text;
  suffix text;
  reference text;
  exists_count integer;
begin
  prefix := 'CN-' || to_char(timezone('utc'::text, now()), 'YYYYMMDD') || '-';
  loop
    suffix := upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 4));
    reference := prefix || suffix;
    select count(*) into exists_count from public.bookings where booking_reference = reference;
    if exists_count = 0 then
      return reference;
    end if;
  end loop;
end;
$$ language plpgsql;

comment on function public.generate_booking_reference() is
  'Creates a short, human-readable booking reference such as CN-20260723-A3F1.';

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

-- Media is created first because workshops, instructors, blog posts and gallery
-- reference it through foreign keys.
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  storage_bucket text not null,
  storage_path text not null unique,
  mime_type text not null,
  width integer,
  height integer,
  file_size_bytes integer,
  alt_text text not null default '',
  caption text,
  source text not null check (source in ('upload', 'wix_import', 'generated')),
  wix_url text,
  checksum text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz
);

comment on table public.media_assets is
  'Storage metadata for uploaded, imported and generated images/files.';
comment on column public.media_assets.original_filename is
  'Exact original filename from the uploader or Wix export. Never modified.';
comment on column public.media_assets.storage_path is
  'Unique storage path. Originals and generated variants use separate paths.';
comment on column public.media_assets.source is
  'upload = user upload, wix_import = imported from Wix, generated = derived variant.';

create index idx_media_assets_storage_path on public.media_assets (storage_path);
create index idx_media_assets_source on public.media_assets (source);
create index idx_media_assets_archived_at on public.media_assets (archived_at) where archived_at is not null;

alter table public.media_assets enable row level security;

-- Workshop categories control the public navigation and can suggest a visual theme.
create table public.workshop_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  suggested_theme text not null check (suggested_theme in ('atelier', 'joyful')),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.workshop_categories is
  'Editable categories for grouping workshops. Slugs map to public routes.';
comment on column public.workshop_categories.suggested_theme is
  'Default visual mode for this category when the visitor has no manual theme choice.';

create index idx_workshop_categories_display on public.workshop_categories (display_order, is_visible);

alter table public.workshop_categories enable row level security;

-- Instructors are public-facing teaching staff. Minimal PII is stored.
create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  slug text not null unique,
  biography text,
  profile_media_id uuid references public.media_assets(id) on delete set null,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.instructors is
  'Public instructor profiles. No sensitive personal data is stored here.';

create index idx_instructors_active on public.instructors (is_active, display_order);

alter table public.instructors enable row level security;

-- Workshops are the core bookable or enquirable products.
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.workshop_categories(id),
  title text not null,
  slug text not null unique,
  short_description text,
  description text,
  practical_information text,
  minimum_age integer,
  maximum_age integer,
  default_duration_minutes integer not null check (default_duration_minutes > 0),
  default_capacity integer not null check (default_capacity > 0),
  default_price_gross_grosz integer not null check (default_price_gross_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  suggested_theme text check (suggested_theme in ('atelier', 'joyful')),
  featured_media_id uuid references public.media_assets(id) on delete set null,
  booking_mode text not null check (booking_mode in ('scheduled', 'enquiry', 'external')),
  status text not null check (status in ('draft', 'published', 'archived')),
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz,
  constraint check_age_range check (minimum_age is null or maximum_age is null or minimum_age <= maximum_age)
);

comment on table public.workshops is
  'Workshop definitions. Content is stored as plain text; rich-text rendering strategy is TBD.';
comment on column public.workshops.description is
  'Plain-text or clearly documented safe rich-text representation. HTML sanitisation is TBD.';
comment on column public.workshops.default_price_gross_grosz is
  'Default price in Polish grosz (1/100 PLN). Snapshotted into bookings at purchase time.';
comment on column public.workshops.booking_mode is
  'scheduled = bookable session, enquiry = contact form, external = link to another system.';
comment on column public.workshops.status is
  'draft, published or archived. Only published non-archived workshops are public.';

create index idx_workshops_category on public.workshops (category_id);
create index idx_workshops_status on public.workshops (status, archived_at);
create index idx_workshops_featured on public.workshops (is_featured) where is_featured = true;

alter table public.workshops enable row level security;

-- Many-to-many link between workshops and instructors.
create table public.workshop_instructors (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  instructor_id uuid not null references public.instructors(id) on delete cascade,
  display_order integer not null default 0,
  primary key (workshop_id, instructor_id)
);

comment on table public.workshop_instructors is
  'Many-to-many relationship ordering instructors per workshop.';

create index idx_workshop_instructors_workshop on public.workshop_instructors (workshop_id, display_order);

alter table public.workshop_instructors enable row level security;

-- Scheduled occurrences of a workshop. The reserved_count cache is only updated
-- through a transactional booking operation in a later phase.
create table public.workshop_sessions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id),
  instructor_id uuid references public.instructors(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Europe/Warsaw',
  capacity integer not null check (capacity > 0),
  reserved_count integer not null default 0 check (reserved_count >= 0 and reserved_count <= capacity),
  price_gross_grosz integer not null check (price_gross_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  location_name text,
  location_address text,
  status text not null check (status in ('draft', 'scheduled', 'sold_out', 'cancelled', 'completed')),
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  external_booking_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint check_session_time check (ends_at > starts_at),
  constraint check_booking_window check (booking_opens_at is null or booking_closes_at is null or booking_opens_at <= booking_closes_at)
);

comment on table public.workshop_sessions is
  'Scheduled instances of workshops. Times are stored in UTC; timezone names are preserved for display.';
comment on column public.workshop_sessions.reserved_count is
  'Cached count of confirmed booking slots. Must only be modified transactionally when bookings change.';
comment on column public.workshop_sessions.timezone is
  'IANA timezone name for display. Europe/Warsaw is the operational default.';

create index idx_workshop_sessions_workshop on public.workshop_sessions (workshop_id, starts_at);
create index idx_workshop_sessions_upcoming on public.workshop_sessions (status, starts_at) where status in ('scheduled', 'sold_out');

alter table public.workshop_sessions enable row level security;

-- Customer profiles can exist before a Supabase Auth account is created.
create table public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  preferred_language text not null default 'pl',
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  privacy_policy_version text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz
);

comment on table public.customer_profiles is
  'Customer records. Designed so Wix customers can be imported before creating Supabase Auth accounts.';
comment on column public.customer_profiles.auth_user_id is
  'Links to Supabase Auth once the customer creates an account. Nullable to support imported profiles.';

create unique index idx_customer_profiles_email_lower on public.customer_profiles (lower(email));
create index idx_customer_profiles_auth on public.customer_profiles (auth_user_id);

alter table public.customer_profiles enable row level security;

-- Bookings are the central order record. Prices are snapshotted at creation time.
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique,
  customer_id uuid not null references public.customer_profiles(id),
  workshop_session_id uuid not null references public.workshop_sessions(id),
  status text not null check (status in ('pending', 'awaiting_payment', 'confirmed', 'cancelled', 'expired', 'refunded', 'partially_refunded')),
  quantity integer not null check (quantity > 0),
  unit_price_gross_grosz integer not null check (unit_price_gross_grosz >= 0),
  total_price_gross_grosz integer not null check (total_price_gross_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  customer_notes text,
  internal_notes text,
  source text not null check (source in ('website', 'admin', 'wix_import')),
  terms_accepted_at timestamptz not null,
  privacy_policy_version text not null,
  expires_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint check_total_price check (total_price_gross_grosz = quantity * unit_price_gross_grosz)
);

comment on table public.bookings is
  'Workshop booking records. Cancellation, refund and expiry rules are TBD.';
comment on column public.bookings.unit_price_gross_grosz is
  'Price per participant in grosz at the time of booking.';
comment on column public.bookings.total_price_gross_grosz is
  'Total price = quantity * unit_price_gross_grosz. Stored to preserve the historical amount.';

create index idx_bookings_customer on public.bookings (customer_id);
create index idx_bookings_session on public.bookings (workshop_session_id);
create index idx_bookings_status on public.bookings (status);

alter table public.bookings enable row level security;

-- Trigger to set a unique booking reference before insert.
create trigger trg_set_booking_reference
before insert on public.bookings
for each row execute function public.generate_booking_reference();

-- Booking participants. Names are optional; dates of birth are not collected.
create table public.booking_participants (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  display_name text,
  age integer,
  participant_type text not null check (participant_type in ('adult', 'child', 'unspecified')),
  accessibility_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.booking_participants is
  'Participants attached to a booking. No dates of birth are stored.';

create index idx_booking_participants_booking on public.booking_participants (booking_id);

alter table public.booking_participants enable row level security;

-- Provider-neutral payment ledger. Stripe integration is a future phase.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider text not null,
  provider_payment_id text,
  provider_checkout_id text,
  status text not null check (status in ('created', 'pending', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded')),
  amount_gross_grosz integer not null check (amount_gross_grosz >= 0),
  currency text not null default 'PLN' check (currency = 'PLN'),
  idempotency_key text unique,
  failure_code text,
  failure_message text,
  paid_at timestamptz,
  refunded_amount_grosz integer not null default 0 check (refunded_amount_grosz >= 0),
  raw_provider_reference text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.payments is
  'Provider-neutral payment ledger. No card details are stored. Stripe integration is TBD.';

create index idx_payments_booking on public.payments (booking_id);

alter table public.payments enable row level security;

-- Workshop media associations.
create table public.workshop_media (
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  role text not null check (role in ('featured', 'gallery', 'detail')),
  display_order integer not null default 0,
  primary key (workshop_id, media_asset_id)
);

comment on table public.workshop_media is
  'Links media assets to workshops with a role (featured, gallery, detail).';

create index idx_workshop_media_workshop on public.workshop_media (workshop_id, role, display_order);

alter table public.workshop_media enable row level security;

-- CMS-like pages for the public website (e.g. /pracownia).
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  status text not null check (status in ('draft', 'published', 'archived')),
  suggested_theme text check (suggested_theme in ('atelier', 'joyful')),
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz
);

comment on table public.content_pages is
  'Static content pages. Content format and sanitisation strategy are TBD.';
comment on column public.content_pages.content is
  'Plain text or documented safe rich-text representation. HTML sanitisation is TBD.';

create index idx_content_pages_slug on public.content_pages (slug, status, archived_at);

alter table public.content_pages enable row level security;

-- Blog posts.
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content text not null,
  featured_media_id uuid references public.media_assets(id) on delete set null,
  status text not null check (status in ('draft', 'published', 'archived')),
  author_name text,
  published_at timestamptz,
  seo_title text,
  seo_description text,
  legacy_wix_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  archived_at timestamptz
);

comment on table public.blog_posts is
  'Blog articles. Content format and sanitisation strategy are TBD.';
comment on column public.blog_posts.legacy_wix_url is
  'Original Wix URL for migration tracking and redirects.';

create index idx_blog_posts_slug on public.blog_posts (slug, status, archived_at);

alter table public.blog_posts enable row level security;

-- Gallery portfolio items.
create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  title text,
  description text,
  category text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.gallery_items is
  'Public gallery items linked to media assets.';

create index idx_gallery_items_visible on public.gallery_items (is_visible, category, display_order);

alter table public.gallery_items enable row level security;

-- Newsletter subscribers with consent evidence.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null check (status in ('subscribed', 'unsubscribed', 'suppressed')),
  consent_at timestamptz not null,
  consent_source text not null,
  privacy_policy_version text not null,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.newsletter_subscribers is
  'Newsletter subscriber list. Consent evidence is preserved per record.';
comment on column public.newsletter_subscribers.consent_source is
  'Where the consent was collected, e.g. website, wix_import, checkout.';

create unique index idx_newsletter_subscribers_email_lower on public.newsletter_subscribers (lower(email));

alter table public.newsletter_subscribers enable row level security;

-- Editable public site settings. No secrets or API keys.
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.site_settings is
  'Editable public site settings. Secrets and API keys are not stored here. Values are validated by application code.';
comment on column public.site_settings.value is
  'JSONB value. The application validates the shape for each known setting key.';

alter table public.site_settings enable row level security;

-- Legacy Wix URL redirects.
create table public.legacy_redirects (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  destination_path text not null,
  status_code integer not null check (status_code in (301, 308)),
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint check_no_loop check (source_path <> destination_path)
);

comment on table public.legacy_redirects is
  'Maps old Wix paths to new internal paths. Only 301 and 308 are supported initially.';
comment on column public.legacy_redirects.source_path is
  'Old path, e.g. /product-page/workshop-name. Must be unique.';
comment on column public.legacy_redirects.destination_path is
  'New internal path. External URLs are not allowed unless explicitly documented.';

create index idx_legacy_redirects_source on public.legacy_redirects (source_path);

alter table public.legacy_redirects enable row level security;

-- ---------------------------------------------------------------------------
-- updated_at triggers for all tables with the column
-- ---------------------------------------------------------------------------

create trigger trg_media_assets_updated_at
before update on public.media_assets for each row execute function public.set_updated_at();

create trigger trg_workshop_categories_updated_at
before update on public.workshop_categories for each row execute function public.set_updated_at();

create trigger trg_instructors_updated_at
before update on public.instructors for each row execute function public.set_updated_at();

create trigger trg_workshops_updated_at
before update on public.workshops for each row execute function public.set_updated_at();

create trigger trg_workshop_instructors_updated_at
before update on public.workshop_instructors for each row execute function public.set_updated_at();

create trigger trg_workshop_sessions_updated_at
before update on public.workshop_sessions for each row execute function public.set_updated_at();

create trigger trg_customer_profiles_updated_at
before update on public.customer_profiles for each row execute function public.set_updated_at();

create trigger trg_bookings_updated_at
before update on public.bookings for each row execute function public.set_updated_at();

create trigger trg_booking_participants_updated_at
before update on public.booking_participants for each row execute function public.set_updated_at();

create trigger trg_payments_updated_at
before update on public.payments for each row execute function public.set_updated_at();

create trigger trg_workshop_media_updated_at
before update on public.workshop_media for each row execute function public.set_updated_at();

create trigger trg_content_pages_updated_at
before update on public.content_pages for each row execute function public.set_updated_at();

create trigger trg_blog_posts_updated_at
before update on public.blog_posts for each row execute function public.set_updated_at();

create trigger trg_gallery_items_updated_at
before update on public.gallery_items for each row execute function public.set_updated_at();

create trigger trg_newsletter_subscribers_updated_at
before update on public.newsletter_subscribers for each row execute function public.set_updated_at();

create trigger trg_legacy_redirects_updated_at
before update on public.legacy_redirects for each row execute function public.set_updated_at();

-- site_settings uses the same function but the column is the only timestamp.
create trigger trg_site_settings_updated_at
before update on public.site_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security policies
-- ---------------------------------------------------------------------------

-- Public read policies for anonymous visitors.
create policy "Public categories are visible"
  on public.workshop_categories for select
  using (is_visible = true);

create policy "Public instructors are active"
  on public.instructors for select
  using (is_active = true);

create policy "Public workshops are published"
  on public.workshops for select
  using (status = 'published' and archived_at is null);

create policy "Public workshop instructors are visible"
  on public.workshop_instructors for select
  using (
    exists (
      select 1 from public.workshops
      where workshops.id = workshop_instructors.workshop_id
        and workshops.status = 'published'
        and workshops.archived_at is null
    )
  );

create policy "Public sessions are scheduled or sold out"
  on public.workshop_sessions for select
  using (
    status in ('scheduled', 'sold_out')
    and exists (
      select 1 from public.workshops
      where workshops.id = workshop_sessions.workshop_id
        and workshops.status = 'published'
        and workshops.archived_at is null
    )
  );

create policy "Public workshop media is visible"
  on public.workshop_media for select
  using (
    exists (
      select 1 from public.workshops
      where workshops.id = workshop_media.workshop_id
        and workshops.status = 'published'
        and workshops.archived_at is null
    )
  );

create policy "Public content pages are published"
  on public.content_pages for select
  using (status = 'published' and archived_at is null);

create policy "Public blog posts are published"
  on public.blog_posts for select
  using (status = 'published' and archived_at is null);

create policy "Public gallery items are visible"
  on public.gallery_items for select
  using (is_visible = true);

create policy "Public media assets are visible"
  on public.media_assets for select
  using (archived_at is null);

create policy "Public site settings are readable"
  on public.site_settings for select
  using (true);

create policy "Public redirects are readable"
  on public.legacy_redirects for select
  using (true);

-- Private tables: no anonymous access. Admin policies will be added later.
create policy "No public customer access"
  on public.customer_profiles for select
  using (false);

create policy "No public booking access"
  on public.bookings for select
  using (false);

create policy "No public participant access"
  on public.booking_participants for select
  using (false);

create policy "No public payment access"
  on public.payments for select
  using (false);

create policy "No public newsletter access"
  on public.newsletter_subscribers for select
  using (false);

-- No anonymous writes anywhere.
create policy "No anonymous inserts on categories"
  on public.workshop_categories for insert with check (false);
create policy "No anonymous updates on categories"
  on public.workshop_categories for update using (false);
create policy "No anonymous deletes on categories"
  on public.workshop_categories for delete using (false);

create policy "No anonymous inserts on workshops"
  on public.workshops for insert with check (false);
create policy "No anonymous updates on workshops"
  on public.workshops for update using (false);
create policy "No anonymous deletes on workshops"
  on public.workshops for delete using (false);

create policy "No anonymous inserts on sessions"
  on public.workshop_sessions for insert with check (false);
create policy "No anonymous updates on sessions"
  on public.workshop_sessions for update using (false);
create policy "No anonymous deletes on sessions"
  on public.workshop_sessions for delete using (false);

create policy "No anonymous inserts on pages"
  on public.content_pages for insert with check (false);
create policy "No anonymous updates on pages"
  on public.content_pages for update using (false);
create policy "No anonymous deletes on pages"
  on public.content_pages for delete using (false);

create policy "No anonymous inserts on blog posts"
  on public.blog_posts for insert with check (false);
create policy "No anonymous updates on blog posts"
  on public.blog_posts for update using (false);
create policy "No anonymous deletes on blog posts"
  on public.blog_posts for delete using (false);

create policy "No anonymous inserts on gallery"
  on public.gallery_items for insert with check (false);
create policy "No anonymous updates on gallery"
  on public.gallery_items for update using (false);
create policy "No anonymous deletes on gallery"
  on public.gallery_items for delete using (false);

create policy "No anonymous inserts on media"
  on public.media_assets for insert with check (false);
create policy "No anonymous updates on media"
  on public.media_assets for update using (false);
create policy "No anonymous deletes on media"
  on public.media_assets for delete using (false);

create policy "No anonymous inserts on instructors"
  on public.instructors for insert with check (false);
create policy "No anonymous updates on instructors"
  on public.instructors for update using (false);
create policy "No anonymous deletes on instructors"
  on public.instructors for delete using (false);

create policy "No anonymous inserts on redirects"
  on public.legacy_redirects for insert with check (false);
create policy "No anonymous updates on redirects"
  on public.legacy_redirects for update using (false);
create policy "No anonymous deletes on redirects"
  on public.legacy_redirects for delete using (false);

create policy "No anonymous writes on site settings"
  on public.site_settings for insert with check (false);
create policy "No anonymous updates on site settings"
  on public.site_settings for update using (false);
create policy "No anonymous deletes on site settings"
  on public.site_settings for delete using (false);
