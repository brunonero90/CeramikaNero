-- Remote verification query for Ceramika Nero Phase 4 activation.
-- Returns one row with aggregated checks.

with expected_tables(t) as (
  values
    ('media_assets'), ('workshop_categories'), ('instructors'), ('workshops'),
    ('workshop_instructors'), ('workshop_sessions'), ('customer_profiles'),
    ('bookings'), ('booking_participants'), ('payments'), ('workshop_media'),
    ('content_pages'), ('blog_posts'), ('gallery_items'),
    ('newsletter_subscribers'), ('site_settings'), ('legacy_redirects'),
    ('admin_users'), ('admin_audit_log')
),
expected_functions(f) as (
  values
    ('set_updated_at'), ('generate_booking_reference'), ('current_admin_role'),
    ('is_active_admin'), ('is_admin_role'), ('upsert_workshop_with_relations')
)
select
  (select count(*) from expected_tables) as expected_table_count,
  (select count(*) from information_schema.tables t
   join expected_tables e on t.table_name = e.t
   where t.table_schema = 'public') as actual_tables,

  (select count(*) from pg_tables pt
   join expected_tables e on pt.tablename = e.t
   where pt.schemaname = 'public' and pt.rowsecurity = true) as rls_enabled_tables,

  (select count(*) from pg_proc p
   join pg_namespace n on p.pronamespace = n.oid
   join expected_functions e on p.proname = e.f
   where n.nspname = 'public') as actual_functions,

  (select count(*) from storage.buckets where id = 'media') as media_bucket,

  (select count(*) from pg_policy
   join pg_class c on pg_policy.polrelid = c.oid
   join pg_namespace n on c.relnamespace = n.oid
   where n.nspname = 'storage' and c.relname = 'objects') as media_storage_policies,

  (select count(*) from pg_trigger where tgname = 'trg_set_booking_reference') as booking_reference_trigger,

  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'workshops' and column_name = 'external_booking_url') as workshop_external_url_column,

  (select count(*) from pg_proc p
   join pg_namespace n on p.pronamespace = n.oid
   where n.nspname = 'public' and p.proname = 'upsert_workshop_with_relations' and p.prosecdef = false) as upsert_workshop_security_invoker,

  (select count(*) from pg_proc p
   join pg_namespace n on p.pronamespace = n.oid
   where n.nspname = 'public' and p.proname = 'current_admin_role' and p.prosecdef = true) as current_admin_role_security_definer,

  (select count(*) from pg_proc p
   join pg_namespace n on p.pronamespace = n.oid
   where n.nspname = 'public' and p.proname = 'set_updated_at' and p.prosecdef = true) as set_updated_at_security_definer,

  (select count(*) from pg_policy
   where polrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)) as total_rls_policies,

  (select count(*) from pg_policy
   join pg_class c on pg_policy.polrelid = c.oid
   where c.relname = 'admin_users') as admin_user_policies,

  (select count(*) from pg_policy
   join pg_class c on pg_policy.polrelid = c.oid
   where c.relname = 'admin_audit_log') as admin_audit_log_policies;
