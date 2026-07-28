-- Ceramika Nero — canonical public contact details.
--
-- Migration 17 updates the authoritative site settings and any already-imported
-- public CMS copy. Historical source captures under reference/original-site are
-- intentionally not database content and remain unchanged.

create function public._migration_17_replace_public_contact(source text)
returns text
language sql
immutable
strict
set search_path = ''
as $function$
  select replace(
    replace(
      replace(
        regexp_replace(
          source,
          '(nerogosia@gmail[.]com|kontakt[.]ceramikanero@gmail[.]com|kontakt@ceramikanero[.]com)',
          'kontakt@ceramikanero.pl',
          'gi'
        ),
        '600 158 318',
        '532 279 101'
      ),
      '600-158-318',
      '532-279-101'
    ),
    '600158318',
    '532279101'
  );
$function$;

insert into public.site_settings (key, value, description)
values
  (
    'studio_email',
    '"kontakt@ceramikanero.pl"'::jsonb,
    'Publiczny adres e-mail studia.'
  ),
  (
    'studio_phone',
    '"+48532279101"'::jsonb,
    'Publiczny numer telefonu studia.'
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = timezone('utc'::text, now());

update public.site_settings
set value = to_jsonb(
  public._migration_17_replace_public_contact(value #>> '{}')
)
where jsonb_typeof(value) = 'string'
  and value #>> '{}' is distinct from
    public._migration_17_replace_public_contact(value #>> '{}');

update public.workshop_categories
set description = public._migration_17_replace_public_contact(description)
where description is distinct from
  public._migration_17_replace_public_contact(description);

update public.workshops
set
  short_description =
    public._migration_17_replace_public_contact(short_description),
  description = public._migration_17_replace_public_contact(description),
  practical_information =
    public._migration_17_replace_public_contact(practical_information),
  seo_title = public._migration_17_replace_public_contact(seo_title),
  seo_description =
    public._migration_17_replace_public_contact(seo_description)
where concat_ws(
  ' ',
  short_description,
  description,
  practical_information,
  seo_title,
  seo_description
) is distinct from public._migration_17_replace_public_contact(
  concat_ws(
    ' ',
    short_description,
    description,
    practical_information,
    seo_title,
    seo_description
  )
);

update public.instructors
set biography = public._migration_17_replace_public_contact(biography)
where biography is distinct from
  public._migration_17_replace_public_contact(biography);

update public.content_pages
set
  excerpt = public._migration_17_replace_public_contact(excerpt),
  content = public._migration_17_replace_public_contact(content),
  seo_title = public._migration_17_replace_public_contact(seo_title),
  seo_description =
    public._migration_17_replace_public_contact(seo_description)
where concat_ws(' ', excerpt, content, seo_title, seo_description)
  is distinct from public._migration_17_replace_public_contact(
    concat_ws(' ', excerpt, content, seo_title, seo_description)
  );

update public.blog_posts
set
  excerpt = public._migration_17_replace_public_contact(excerpt),
  content = public._migration_17_replace_public_contact(content),
  seo_title = public._migration_17_replace_public_contact(seo_title),
  seo_description =
    public._migration_17_replace_public_contact(seo_description)
where concat_ws(' ', excerpt, content, seo_title, seo_description)
  is distinct from public._migration_17_replace_public_contact(
    concat_ws(' ', excerpt, content, seo_title, seo_description)
  );

update public.gallery_items
set
  title = public._migration_17_replace_public_contact(title),
  description = public._migration_17_replace_public_contact(description),
  category = public._migration_17_replace_public_contact(category)
where concat_ws(' ', title, description, category)
  is distinct from public._migration_17_replace_public_contact(
    concat_ws(' ', title, description, category)
  );

update public.media_assets
set
  alt_text = public._migration_17_replace_public_contact(alt_text),
  caption = public._migration_17_replace_public_contact(caption)
where concat_ws(' ', alt_text, caption)
  is distinct from public._migration_17_replace_public_contact(
    concat_ws(' ', alt_text, caption)
  );

update public.products
set
  short_description =
    public._migration_17_replace_public_contact(short_description),
  description = public._migration_17_replace_public_contact(description),
  seo_title = public._migration_17_replace_public_contact(seo_title),
  seo_description =
    public._migration_17_replace_public_contact(seo_description),
  images = (
    public._migration_17_replace_public_contact(images::text)
  )::jsonb
where concat_ws(
  ' ',
  short_description,
  description,
  seo_title,
  seo_description,
  images::text
) is distinct from public._migration_17_replace_public_contact(
  concat_ws(
    ' ',
    short_description,
    description,
    seo_title,
    seo_description,
    images::text
  )
);

drop function public._migration_17_replace_public_contact(text);
