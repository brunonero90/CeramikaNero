-- Ceramika Nero — Phase 4 admin helper functions
--
-- Adds atomic database functions for multi-table workshop writes so that
-- workshop, instructor and media relations are updated together. These
-- functions run as the invoker so RLS policies continue to enforce admin roles.

create or replace function public.upsert_workshop_with_relations(
  p_workshop_id uuid,
  p_category_id uuid,
  p_title text,
  p_slug text,
  p_short_description text,
  p_description text,
  p_practical_information text,
  p_minimum_age integer,
  p_maximum_age integer,
  p_default_duration_minutes integer,
  p_default_capacity integer,
  p_default_price_gross_grosz integer,
  p_suggested_theme text,
  p_featured_media_id uuid,
  p_booking_mode text,
  p_external_booking_url text,
  p_status text,
  p_is_featured boolean,
  p_seo_title text,
  p_seo_description text,
  p_instructor_ids uuid[],
  p_gallery_media jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_workshop_id uuid;
  v_old_slug text;
  v_old_status text;
begin
  if p_workshop_id is null then
    insert into public.workshops (
      category_id,
      title,
      slug,
      short_description,
      description,
      practical_information,
      minimum_age,
      maximum_age,
      default_duration_minutes,
      default_capacity,
      default_price_gross_grosz,
      suggested_theme,
      featured_media_id,
      booking_mode,
      external_booking_url,
      status,
      is_featured,
      seo_title,
      seo_description
    ) values (
      p_category_id,
      p_title,
      p_slug,
      p_short_description,
      p_description,
      p_practical_information,
      p_minimum_age,
      p_maximum_age,
      p_default_duration_minutes,
      p_default_capacity,
      p_default_price_gross_grosz,
      p_suggested_theme,
      p_featured_media_id,
      p_booking_mode,
      p_external_booking_url,
      p_status,
      p_is_featured,
      p_seo_title,
      p_seo_description
    ) returning id into v_workshop_id;
  else
    select slug, status into v_old_slug, v_old_status
    from public.workshops
    where id = p_workshop_id;

    update public.workshops set
      category_id = p_category_id,
      title = p_title,
      slug = p_slug,
      short_description = p_short_description,
      description = p_description,
      practical_information = p_practical_information,
      minimum_age = p_minimum_age,
      maximum_age = p_maximum_age,
      default_duration_minutes = p_default_duration_minutes,
      default_capacity = p_default_capacity,
      default_price_gross_grosz = p_default_price_gross_grosz,
      suggested_theme = p_suggested_theme,
      featured_media_id = p_featured_media_id,
      booking_mode = p_booking_mode,
      external_booking_url = p_external_booking_url,
      status = p_status,
      is_featured = p_is_featured,
      seo_title = p_seo_title,
      seo_description = p_seo_description
    where id = p_workshop_id
    returning id into v_workshop_id;

    if v_old_slug is distinct from p_slug and v_old_status = 'published' then
      insert into public.legacy_redirects (
        source_path,
        destination_path,
        status_code,
        notes
      ) values (
        '/warsztaty/' || v_old_slug,
        '/warsztaty/' || p_slug,
        301,
        'Automatyczne przekierowanie po zmianie slug warsztatu'
      )
      on conflict (source_path) do nothing;
    end if;
  end if;

  delete from public.workshop_instructors where workshop_id = v_workshop_id;
  if p_instructor_ids is not null and array_length(p_instructor_ids, 1) > 0 then
    insert into public.workshop_instructors (workshop_id, instructor_id, display_order)
    select v_workshop_id, t.id, t.ord
    from unnest(p_instructor_ids) with ordinality as t(id, ord);
  end if;

  delete from public.workshop_media where workshop_id = v_workshop_id;
  if p_gallery_media is not null and jsonb_array_length(p_gallery_media) > 0 then
    insert into public.workshop_media (workshop_id, media_asset_id, role, display_order)
    select
      v_workshop_id,
      (elem->>'media_asset_id')::uuid,
      (elem->>'role')::text,
      row_number() over ()
    from jsonb_array_elements(p_gallery_media) as elem;
  end if;

  return v_workshop_id;
end;
$$;

comment on function public.upsert_workshop_with_relations(uuid, uuid, text, text, text, text, text, integer, integer, integer, integer, integer, text, uuid, text, text, text, boolean, text, text, uuid[], jsonb) is
  'Atomic insert or update of a workshop together with its instructor and media gallery relations. Creates a 301 redirect when a published workshop slug changes.';
