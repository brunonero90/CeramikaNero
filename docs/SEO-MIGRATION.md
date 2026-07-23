# SEO Migration

## URL strategy

- Prefer Polish, descriptive slugs (`/warsztaty`, `/dla-dzieci`, `/galeria`).
- Use consistent trailing-slash behaviour (no trailing slash).
- Implement redirects for any changed Wix URLs via `legacy_redirects`.
- Workshop detail URLs use `/warsztaty/{slug}`.
- Category landing URLs match category slugs: `/dla-dzieci`, `/dla-doroslych`,
  `/grupy-i-firmy`.

## Metadata

- Root metadata in `app/layout.tsx` defines title template, description,
  keywords and Open Graph defaults.
- Each page exports its own `metadata` object with Polish title and description.
- `metadataBase` is set from `NEXT_PUBLIC_SITE_URL`.
- Workshop detail pages use `generateMetadata` to read SEO title/description from
  the database.
- Default SEO values can be stored in `site_settings` and used as fallbacks.

## Open Graph

- Default Open Graph title, description, site name and `pl_PL` locale.
- Per-page OG images will be added once design assets are available.
- Workshop detail OG metadata is generated from `workshops.seo_title` and
  `workshops.seo_description`.

## Sitemap

- A dynamic sitemap will be generated at `app/sitemap.ts` once the database is
  connected.
- It will include static pages, published workshops, content pages, blog posts
  and gallery items.
- Draft and archived content is excluded.

## Robots

- `robots.ts` will allow indexing of public pages and disallow admin routes and
  preview URLs.
- Admin routes are protected and do not appear in the sitemap.
- Preview URLs return `noindex, nofollow` for unpublished content.

## Structured data

- LocalBusiness schema for Ceramika Nero (name, address, opening hours).
- Event or Course schema for workshops (future phase).
- BreadcrumbList schema for navigation (future phase).

## Redirects

- Wix redirects are stored in `legacy_redirects` with status codes 301 or 308.
- Redirects are validated against a Zod schema to prevent loops and chains.
- A runtime redirect lookup service is available in `services.redirects`.
- When an admin changes the slug of a published workshop, page or blog post, a new
  `legacy_redirects` entry is created from the old public path to the new path (301),
  unless a redirect already exists.

## Decisions to clarify (TBD)

- TBD: Exact existing Wix URLs that must redirect to the new site.
- TBD: Which pages are currently indexed by search engines and should be
  preserved.
- TBD: Whether to keep any legacy English URLs or keywords.
- TBD: Availability of studio photos and logo for OG images.
- TBD: Google Search Console and Google Analytics account access.
- TBD: Whether to generate a dynamic sitemap during the build or at request time.
