# SEO Migration

## URL strategy

- Prefer Polish, descriptive slugs (`/warsztaty`, `/dla-dzieci`, `/galeria`).
- Use consistent trailing-slash behaviour (no trailing slash).
- Implement redirects for any changed Wix URLs.

## Metadata

- Root metadata in `app/layout.tsx` defines title template, description,
  keywords and Open Graph defaults.
- Each page will export its own `metadata` object with Polish title and
  description.
- `metadataBase` is set from `NEXT_PUBLIC_SITE_URL`.

## Open Graph

- Default Open Graph title, description, site name and `pl_PL` locale.
- Per-page OG images will be added once design assets are available.

## Sitemap

- A dynamic sitemap will be generated at `app/sitemap.ts` once the database is
  connected.
- It will include static pages, workshops, blog posts and gallery items.

## Robots

- `robots.ts` will allow indexing of public pages and disallow admin routes.

## Structured data

- LocalBusiness schema for Ceramika Nero (name, address, opening hours).
- Event or Course schema for workshops (future phase).
- BreadcrumbList schema for navigation (future phase).

## Decisions to clarify (TBD)

- TBD: Exact existing Wix URLs that must redirect to the new site.
- TBD: Which pages are currently indexed by search engines and should be
  preserved.
- TBD: Whether to keep any legacy English URLs or keywords.
- TBD: Availability of studio photos and logo for OG images.
- TBD: Google Search Console and Google Analytics account access.
