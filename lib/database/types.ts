/**
 * DATABASE TYPE BARREL
 *
 * Generated types come from `lib/database/generated-types.ts` (produced by
 * `npm run db:types`). Custom application/domain types live in
 * `lib/database/domain.ts` and are preserved across regenerations.
 *
 * Do not manually edit `lib/database/generated-types.ts`. If the database schema
 * changes, rerun `npm run db:types` and then fix any TypeScript mismatches in
 * application code or in this barrel file.
 */

import type { Database } from './generated-types';
export type { Database, Json } from './generated-types';
export * from './domain';

// Convenience aliases for generated row types (snake_case, matching the database).
export type DbWorkshopCategory =
  Database['public']['Tables']['workshop_categories']['Row'];
export type DbInstructor = Database['public']['Tables']['instructors']['Row'];
export type DbMediaAsset = Database['public']['Tables']['media_assets']['Row'];
export type DbWorkshop = Database['public']['Tables']['workshops']['Row'];
export type DbWorkshopInstructor =
  Database['public']['Tables']['workshop_instructors']['Row'];
export type DbWorkshopSession =
  Database['public']['Tables']['workshop_sessions']['Row'];
export type DbCustomerProfile =
  Database['public']['Tables']['customer_profiles']['Row'];
export type DbBooking = Database['public']['Tables']['bookings']['Row'];
export type DbBookingParticipant =
  Database['public']['Tables']['booking_participants']['Row'];
export type DbPayment = Database['public']['Tables']['payments']['Row'];
export type DbWorkshopMedia =
  Database['public']['Tables']['workshop_media']['Row'];
export type DbContentPage =
  Database['public']['Tables']['content_pages']['Row'];
export type DbBlogPost = Database['public']['Tables']['blog_posts']['Row'];
export type DbGalleryItem =
  Database['public']['Tables']['gallery_items']['Row'];
export type DbNewsletterSubscriber =
  Database['public']['Tables']['newsletter_subscribers']['Row'];
export type DbSiteSetting =
  Database['public']['Tables']['site_settings']['Row'];
export type DbLegacyRedirect =
  Database['public']['Tables']['legacy_redirects']['Row'];
export type DbAdminUser = Database['public']['Tables']['admin_users']['Row'];
export type DbAdminAuditLog =
  Database['public']['Tables']['admin_audit_log']['Row'];

// Supabase type generator does not preserve nullability for function arguments,
// so the generated args are stricter than the actual database function. The
// underlying function accepts nulls for all nullable parameters. Cast at the
// RPC call site is therefore a generator-workaround, not a schema mismatch.
export type UpsertWorkshopWithRelationsArgs =
  Database['public']['Functions']['upsert_workshop_with_relations']['Args'];
