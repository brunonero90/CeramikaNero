-- Ceramika Nero — Phase 3 administration and audit layer
--
-- Adds role-based administrator access, audit logging, media storage bucket and
-- role-aware Row Level Security policies. This migration does not modify or
-- drop any existing Phase 2 tables or data.

-- ---------------------------------------------------------------------------
-- Admin users
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'editor')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_login_at timestamptz
);

comment on table public.admin_users is
  'Active administrators and their roles. Roles are stored here, never in Supabase Auth user metadata.';
comment on column public.admin_users.role is
  'owner = full access, manager = content and workshops, editor = content and media only.';
comment on column public.admin_users.is_active is
  'Inactive administrators are blocked from the admin area even if their Auth session is valid.';
comment on column public.admin_users.last_login_at is
  'Last successful login timestamp, updated by the application after login.';

create index idx_admin_users_role on public.admin_users (role, is_active);
create index idx_admin_users_active on public.admin_users (is_active) where is_active = true;

alter table public.admin_users enable row level security;

create trigger trg_admin_users_updated_at
before update on public.admin_users for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_role text not null check (actor_role in ('owner', 'manager', 'editor')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  changed_fields jsonb,
  request_metadata jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.admin_audit_log is
  'Append-only record of significant administrative actions. Not a full legal/compliance audit system.';
comment on column public.admin_audit_log.changed_fields is
  'Field names and redacted summaries for tracked changes. Never stores passwords or secrets.';
comment on column public.admin_audit_log.request_metadata is
  'Safe request context such as IP and user agent. Secrets and tokens must never be included.';

create index idx_admin_audit_log_actor on public.admin_audit_log (actor_user_id, created_at);
create index idx_admin_audit_log_entity on public.admin_audit_log (entity_type, entity_id, created_at);
create index idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- Role helper functions
--
-- These are security definer functions because the caller (an authenticated
-- admin via the SSR client) may be subject to restrictive RLS policies on
-- admin_users. The functions run as the migration owner to read the role table
-- and return the caller's role. They use auth.uid() instead of a client-provided
-- user ID, accept no sensitive parameters, and set an explicit search_path.
-- ---------------------------------------------------------------------------

create or replace function public.current_admin_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from public.admin_users
  where user_id = auth.uid()
    and is_active = true;
$$;

comment on function public.current_admin_role() is
  'Returns the active role of the current Supabase Auth user, or null if not an active admin.';

create or replace function public.is_active_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_admin_role() is not null;
$$;

comment on function public.is_active_admin() is
  'Returns true when the current Supabase Auth user is an active administrator.';

create or replace function public.is_admin_role(required_role text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and is_active = true
      and role = required_role
  );
$$;

comment on function public.is_admin_role(text) is
  'Returns true when the current Supabase Auth user has the exact requested active role.';

revoke all on function public.current_admin_role() from public;
revoke all on function public.is_active_admin() from public;
revoke all on function public.is_admin_role(text) from public;

grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.is_admin_role(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Media storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Row Level Security policies for administration
-- ---------------------------------------------------------------------------

-- Admins can view their own admin_users record (for layout/profile).
create policy "Admins can view own admin record"
  on public.admin_users for select
  to authenticated
  using (user_id = auth.uid() and is_active = true);

-- Owners can manage all admin users.
create policy "Owners can manage admin users"
  on public.admin_users for all
  to authenticated
  using (public.is_admin_role('owner'))
  with check (public.is_admin_role('owner'));

-- Audit log: append-only by any active admin, viewable only by owners.
create policy "Admins can append audit records"
  on public.admin_audit_log for insert
  to authenticated
  with check (public.is_active_admin() and actor_user_id = auth.uid());

create policy "Owners can view audit log"
  on public.admin_audit_log for select
  to authenticated
  using (public.is_admin_role('owner'));

-- Site settings and redirects: owner-only.
create policy "Owners can manage site settings"
  on public.site_settings for all
  to authenticated
  using (public.is_admin_role('owner'))
  with check (public.is_admin_role('owner'));

create policy "Owners can manage redirects"
  on public.legacy_redirects for all
  to authenticated
  using (public.is_admin_role('owner'))
  with check (public.is_admin_role('owner'));

-- Workshop content: managers and owners can manage.
create policy "Managers and owners can manage categories"
  on public.workshop_categories for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage workshops"
  on public.workshops for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage workshop sessions"
  on public.workshop_sessions for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage instructors"
  on public.instructors for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage workshop instructor links"
  on public.workshop_instructors for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

create policy "Managers and owners can manage workshop media links"
  on public.workshop_media for all
  to authenticated
  using (public.is_admin_role('owner') or public.is_admin_role('manager'))
  with check (public.is_admin_role('owner') or public.is_admin_role('manager'));

-- Content pages, blog posts, gallery and media assets: editors, managers and owners can manage.
create policy "Editors managers and owners can manage pages"
  on public.content_pages for all
  to authenticated
  using (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  )
  with check (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  );

create policy "Editors managers and owners can manage blog posts"
  on public.blog_posts for all
  to authenticated
  using (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  )
  with check (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  );

create policy "Editors managers and owners can manage gallery items"
  on public.gallery_items for all
  to authenticated
  using (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  )
  with check (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  );

create policy "Editors managers and owners can manage media assets"
  on public.media_assets for all
  to authenticated
  using (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  )
  with check (
    public.is_admin_role('owner')
    or public.is_admin_role('manager')
    or public.is_admin_role('editor')
  );

-- ---------------------------------------------------------------------------
-- Storage object policies for the media bucket
-- ---------------------------------------------------------------------------

create policy "Public media reads"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Admins can upload to media bucket"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and public.is_active_admin()
  );

create policy "Admins can update media bucket objects"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'media' and public.is_active_admin())
  with check (bucket_id = 'media' and public.is_active_admin());

create policy "Admins can delete media bucket objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.is_active_admin());
