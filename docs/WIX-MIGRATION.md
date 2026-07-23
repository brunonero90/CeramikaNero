# Wix Migration

## Current site

The existing website is hosted on Wix at https://www.ceramikanero.com/.

## Migration scope

- Rebuild the public-facing site in Next.js.
- Preserve high-value URLs where possible.
- Migrate static content (text, images, contact details).
- Recreate workshop listings as database-driven content.
- Replace Wix booking forms with custom booking and payment flows.

## Content mapping

| Wix page / section | New location     | Notes                   |
| ------------------ | ---------------- | ----------------------- |
| Homepage           | `/`              | Rebuilt with new design |
| Workshops          | `/warsztaty`     | Database-driven         |
| For children       | `/dla-dzieci`    | Filtered workshops      |
| For adults         | `/dla-doroslych` | Filtered workshops      |
| Groups / companies | `/grupy-i-firmy` | Custom page + form      |
| Gallery            | `/galeria`       | Database-driven images  |
| Blog               | `/blog`          | Database-driven posts   |
| Contact            | `/kontakt`       | Future route            |

## URL redirects

- A redirect map will be created for any Wix URLs that cannot be preserved.
- Netlify redirects will be configured in `_redirects` or `next.config.ts`.
- Redirects should be tested before DNS cutover.

## Images and assets

- Images will be exported from Wix and uploaded to Supabase Storage or a
  Netlify-compatible CDN.
- All image references will be updated to use Next.js `Image` with width,
  height and alt text.

## Decisions to clarify (TBD)

- TBD: Exact list of existing Wix pages and their URLs.
- TBD: Which pages must be preserved for SEO and which can be removed.
- TBD: Whether Wix bookings and customer data can be exported and migrated.
- TBD: Date of planned DNS cutover and staging domain strategy.
- TBD: Whether any Wix plugins or third-party integrations must be replaced.
