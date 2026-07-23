# Database

## Overview

The application will use Supabase as its primary database and backend platform.
This phase does not configure Supabase or create real schemas. The sections
below describe the intended structure.

## Proposed tables

### `profiles`

- `id` (uuid, primary key, references auth.users)
- `email` (text)
- `first_name` (text)
- `last_name` (text)
- `phone` (text, nullable)
- `role` (enum: customer, admin)
- `created_at`, `updated_at`

### `workshops`

- `id` (uuid, primary key)
- `slug` (text, unique)
- `title` (text)
- `description` (text)
- `category` (enum: children, adults, family, group, event)
- `audience` (text)
- `duration_minutes` (integer)
- `max_participants` (integer)
- `price_pln` (integer, stored in grosze)
- `image_url` (text, nullable)
- `published` (boolean)
- `created_at`, `updated_at`

### `workshop_instances`

- `id` (uuid, primary key)
- `workshop_id` (uuid, references workshops)
- `starts_at` (timestamptz)
- `ends_at` (timestamptz)
- `capacity` (integer)
- `booked_count` (integer)
- `status` (enum: scheduled, cancelled, completed)
- `created_at`, `updated_at`

### `bookings`

- `id` (uuid, primary key)
- `instance_id` (uuid, references workshop_instances)
- `profile_id` (uuid, references profiles, nullable for guest checkout)
- `guest_email` (text, nullable)
- `guest_phone` (text, nullable)
- `participants` (integer)
- `total_amount_pln` (integer)
- `status` (enum: pending, confirmed, cancelled, refunded)
- `stripe_payment_intent_id` (text, nullable)
- `created_at`, `updated_at`

### `blog_posts`

- `id` (uuid, primary key)
- `slug` (text, unique)
- `title` (text)
- `excerpt` (text)
- `content` (text)
- `published_at` (timestamptz, nullable)
- `featured_image_url` (text, nullable)
- `created_at`, `updated_at`

### `gallery_items`

- `id` (uuid, primary key)
- `title` (text)
- `description` (text, nullable)
- `image_url` (text)
- `category` (text, nullable)
- `display_order` (integer)
- `created_at`, `updated_at`

## Row Level Security

- Profiles can be read and updated by their owner or an admin.
- Workshops and instances are readable by everyone but writable only by admins.
- Bookings are readable by their owner or an admin.
- Blog posts and gallery items are readable by everyone but writable only by
  admins.

## Indexes

- `workshops.slug`, `workshops.category`
- `workshop_instances.starts_at`, `workshop_instances.status`
- `bookings.instance_id`, `bookings.profile_id`, `bookings.stripe_payment_intent_id`
- `blog_posts.slug`, `blog_posts.published_at`

## Decisions to clarify (TBD)

- TBD: Final table and column names; whether to use Supabase generated schemas
  or custom migration files.
- TBD: How to handle multi-participant bookings (single booking for many people
  vs. one booking per participant).
- TBD: Whether to store historical price changes.
- TBD: Whether to add a separate `categories` table or use an enum.
- TBD: File naming strategy for uploaded images.
