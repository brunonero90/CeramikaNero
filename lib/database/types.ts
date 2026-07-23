/**
 * TEMPORARY MANUAL DATABASE TYPES
 *
 * These types mirror the Supabase migrations in `supabase/migrations/`. Once
 * the real Supabase project is connected and migrations are applied, this file
 * is replaced by the output of `npm run db:types` (which writes the generated
 * Supabase client types to `lib/database/generated-types.ts`).
 *
 * Custom application/domain types are intentionally kept in
 * `lib/database/domain.ts` so that regenerating the database types never
 * erases them. This file re-exports domain types for convenience during the
 * manual-type period.
 */

import type {
  AdminRole,
  BookingMode,
  BookingSource,
  BookingStatus,
  ContentStatus,
  MediaRole,
  MediaSource,
  ParticipantType,
  PaymentStatus,
  SessionStatus,
  SubscriberStatus,
  Theme,
} from './domain';

export * from './domain';

export type DbWorkshopCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  suggested_theme: Theme;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type DbInstructor = {
  id: string;
  display_name: string;
  slug: string;
  biography: string | null;
  profile_media_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type DbMediaAsset = {
  id: string;
  original_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
  alt_text: string;
  caption: string | null;
  source: MediaSource;
  wix_url: string | null;
  checksum: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DbWorkshop = {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  practical_information: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  default_duration_minutes: number;
  default_capacity: number;
  default_price_gross_grosz: number;
  currency: string;
  suggested_theme: Theme | null;
  featured_media_id: string | null;
  booking_mode: BookingMode;
  external_booking_url: string | null;
  status: ContentStatus;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DbWorkshopInstructor = {
  workshop_id: string;
  instructor_id: string;
  display_order: number;
};

export type DbWorkshopSession = {
  id: string;
  workshop_id: string;
  instructor_id: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  capacity: number;
  reserved_count: number;
  price_gross_grosz: number;
  currency: string;
  location_name: string | null;
  location_address: string | null;
  status: SessionStatus;
  booking_opens_at: string | null;
  booking_closes_at: string | null;
  external_booking_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DbCustomerProfile = {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  preferred_language: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  privacy_policy_version: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DbBooking = {
  id: string;
  booking_reference: string;
  customer_id: string;
  workshop_session_id: string;
  status: BookingStatus;
  quantity: number;
  unit_price_gross_grosz: number;
  total_price_gross_grosz: number;
  currency: string;
  customer_notes: string | null;
  internal_notes: string | null;
  source: BookingSource;
  terms_accepted_at: string;
  privacy_policy_version: string;
  expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbBookingParticipant = {
  id: string;
  booking_id: string;
  display_name: string | null;
  age: number | null;
  participant_type: ParticipantType;
  accessibility_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbPayment = {
  id: string;
  booking_id: string;
  provider: string;
  provider_payment_id: string | null;
  provider_checkout_id: string | null;
  status: PaymentStatus;
  amount_gross_grosz: number;
  currency: string;
  idempotency_key: string | null;
  failure_code: string | null;
  failure_message: string | null;
  paid_at: string | null;
  refunded_amount_grosz: number;
  raw_provider_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type DbWorkshopMedia = {
  workshop_id: string;
  media_asset_id: string;
  role: MediaRole;
  display_order: number;
};

export type DbContentPage = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: ContentStatus;
  suggested_theme: Theme | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DbBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_media_id: string | null;
  status: ContentStatus;
  author_name: string | null;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  legacy_wix_url: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type DbGalleryItem = {
  id: string;
  media_asset_id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type DbNewsletterSubscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  consent_at: string;
  consent_source: string;
  privacy_policy_version: string;
  unsubscribed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSiteSetting = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
};

export type DbLegacyRedirect = {
  id: string;
  source_path: string;
  destination_path: string;
  status_code: 301 | 308;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAdminUser = {
  user_id: string;
  role: AdminRole;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type DbAdminAuditLog = {
  id: string;
  actor_user_id: string;
  actor_role: AdminRole;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  changed_fields: unknown;
  request_metadata: unknown;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      media_assets: {
        Row: DbMediaAsset;
      };
      workshop_categories: {
        Row: DbWorkshopCategory;
      };
      instructors: {
        Row: DbInstructor;
      };
      workshops: {
        Row: DbWorkshop;
      };
      workshop_instructors: {
        Row: DbWorkshopInstructor;
      };
      workshop_sessions: {
        Row: DbWorkshopSession;
      };
      customer_profiles: {
        Row: DbCustomerProfile;
      };
      bookings: {
        Row: DbBooking;
      };
      booking_participants: {
        Row: DbBookingParticipant;
      };
      payments: {
        Row: DbPayment;
      };
      workshop_media: {
        Row: DbWorkshopMedia;
      };
      content_pages: {
        Row: DbContentPage;
      };
      blog_posts: {
        Row: DbBlogPost;
      };
      gallery_items: {
        Row: DbGalleryItem;
      };
      newsletter_subscribers: {
        Row: DbNewsletterSubscriber;
      };
      site_settings: {
        Row: DbSiteSetting;
      };
      legacy_redirects: {
        Row: DbLegacyRedirect;
      };
      admin_users: {
        Row: DbAdminUser;
      };
      admin_audit_log: {
        Row: DbAdminAuditLog;
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_updated_at: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      generate_booking_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_admin_role: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      is_active_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_admin_role: {
        Args: { required_role: string };
        Returns: boolean;
      };
      upsert_workshop_with_relations: {
        Args: {
          p_workshop_id: string | null;
          p_category_id: string;
          p_title: string;
          p_slug: string;
          p_short_description: string | null;
          p_description: string | null;
          p_practical_information: string | null;
          p_minimum_age: number | null;
          p_maximum_age: number | null;
          p_default_duration_minutes: number;
          p_default_capacity: number;
          p_default_price_gross_grosz: number;
          p_suggested_theme: string | null;
          p_featured_media_id: string | null;
          p_booking_mode: string;
          p_external_booking_url: string | null;
          p_status: string;
          p_is_featured: boolean;
          p_seo_title: string | null;
          p_seo_description: string | null;
          p_instructor_ids: string[];
          p_gallery_media: unknown;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
};
