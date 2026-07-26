-- Ceramika Nero — enquiries inbox + expanded order email types.
-- Additive. Does not rewrite migrations 11–12.
-- Rollback notes: drop enquiries tables/policies; restore prior order_emails check.

-- ---------------------------------------------------------------------------
-- Expand order_emails.email_type for operational messaging
-- ---------------------------------------------------------------------------

alter table public.order_emails
  drop constraint if exists order_emails_email_type_check;

alter table public.order_emails
  add constraint order_emails_email_type_check
  check (email_type in (
    'customer_confirmation',
    'admin_notification',
    'shipping_quote_confirmed',
    'payment_received',
    'ready_for_pickup',
    'order_shipped',
    'cancellation'
  ));

-- ---------------------------------------------------------------------------
-- Structured enquiries (private; admin-managed)
-- ---------------------------------------------------------------------------

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in (
    'new', 'contacted', 'quoted', 'won', 'lost', 'archived'
  )),
  offer_key text,
  offer_title text,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  preferred_contact text check (
    preferred_contact is null
    or preferred_contact in ('email', 'phone', 'whatsapp')
  ),
  event_type text,
  participant_count integer check (
    participant_count is null or participant_count > 0
  ),
  preferred_date_text text,
  message text not null,
  privacy_accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  source text not null default 'website',
  internal_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.enquiries is
  'Public enquiry submissions for enquiry-only offers and private events.';

create index if not exists idx_enquiries_status_created
  on public.enquiries (status, created_at desc);

create index if not exists idx_enquiries_offer
  on public.enquiries (offer_key)
  where offer_key is not null;

create table if not exists public.enquiry_events (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'customer', 'admin')),
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_enquiry_events_enquiry
  on public.enquiry_events (enquiry_id, created_at desc);

alter table public.enquiries enable row level security;
alter table public.enquiry_events enable row level security;

drop policy if exists "Managers and owners can view enquiries" on public.enquiries;
create policy "Managers and owners can view enquiries"
  on public.enquiries for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Managers and owners can update enquiries" on public.enquiries;
create policy "Managers and owners can update enquiries"
  on public.enquiries for update
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage enquiries" on public.enquiries;
create policy "Service role can manage enquiries"
  on public.enquiries for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Managers and owners can view enquiry events" on public.enquiry_events;
create policy "Managers and owners can view enquiry events"
  on public.enquiry_events for select
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'));

drop policy if exists "Service role can manage enquiry events" on public.enquiry_events;
create policy "Service role can manage enquiry events"
  on public.enquiry_events for all
  to service_role
  using (true)
  with check (true);

-- Public inserts go through service-role server action only (no anon insert policy).
