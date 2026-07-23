# Admin

## Overview

Admins will manage workshops, bookings, blog posts, gallery items and site
content. Authentication will be handled by Supabase Auth.

## Admin capabilities

- Create, edit and unpublish workshops and workshop instances.
- View bookings, filter by status and date.
- Cancel or refund bookings (subject to business rules).
- Upload and manage images in Supabase Storage.
- Publish and edit blog posts.
- Update gallery items and their order.
- Configure basic site settings (opening hours, contact details).

## Authentication

- Admin users will be stored in Supabase Auth.
- A `role` column on the `profiles` table will distinguish `admin` from
  `customer`.
- Row Level Security policies will restrict admin-only tables to users with the
  admin role.

## Content management

- Initially, content will be edited through a custom admin dashboard or directly
  in Supabase Studio.
- Long-term, a lightweight CMS dashboard may be built inside the application.

## Decisions to clarify (TBD)

- TBD: Which admin actions require audit logging.
- TBD: Whether the admin dashboard is a separate route or a dedicated subdomain.
- TBD: Whether to support multiple admin roles (editor, manager, owner).
- TBD: Whether customers can view and manage their own bookings without admin
  access.
- TBD: Email notifications sent to admins for new bookings.
