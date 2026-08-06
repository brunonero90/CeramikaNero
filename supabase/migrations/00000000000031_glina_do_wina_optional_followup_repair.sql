-- Ceramika Nero — repair production Glina do Wina optional glazing configuration.
-- Apply after migration 30.

-- Migration 26 configured Glina do Wina only when a glazing workshop already
-- existed at that exact migration moment. Production workshops can be created
-- later through the admin portal, so resolve the relationship from current data.
do $$
declare
  v_primary uuid;
  v_existing_followup uuid;
  v_followup uuid;
  v_followup_type text;
begin
  select id, followup_workshop_id
    into v_primary, v_existing_followup
  from public.workshops
  where slug in ('glina-do-wina', 'glinadowina')
     or lower(trim(title)) = 'glina do wina'
  order by created_at asc
  limit 1;

  if v_primary is null then
    raise notice 'Glina do Wina workshop not found; optional follow-up repair skipped';
    return;
  end if;

  select w.id,
         coalesce(nullif(trim(w.workshop_type), ''), w.slug, 'szkliwienie')
    into v_followup, v_followup_type
  from public.workshops w
  where w.id <> v_primary
    and w.status = 'published'
    and w.archived_at is null
    and w.booking_mode = 'scheduled'
    and (
      w.id = v_existing_followup
      or lower(w.slug) like '%szkliw%'
      or lower(w.title) like '%szkliw%'
      or lower(coalesce(w.workshop_type, '')) like '%szkliw%'
    )
  order by
    case when w.id = v_existing_followup then 0 else 1 end,
    case when exists (
      select 1
      from public.workshop_sessions s
      where s.workshop_id = w.id
        and s.starts_at > timezone('utc'::text, now())
        and s.status in ('scheduled', 'sold_out')
    ) then 0 else 1 end,
    w.created_at asc
  limit 1;

  update public.workshops
  set offers_followup_session = true,
      requires_followup_session = false,
      followup_workshop_id = coalesce(v_followup, followup_workshop_id),
      followup_workshop_type = coalesce(
        v_followup_type,
        nullif(trim(followup_workshop_type), ''),
        'szkliwienie'
      ),
      followup_min_days = coalesce(followup_min_days, 5),
      followup_max_days = coalesce(followup_max_days, 45),
      updated_at = timezone('utc'::text, now())
  where id = v_primary;

  if v_followup is null then
    raise notice 'Glina do Wina now offers optional glazing, but no published glazing workshop was auto-detected';
  end if;
end
$$;
