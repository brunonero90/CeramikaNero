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

import type {
  Database as GeneratedDatabase,
  Json as GeneratedJson,
} from './generated-types';

export type Json = GeneratedJson;

/**
 * Phase 5 schema augmentation. The generated types will be regenerated after the
 * remote migration is applied; until then, this local augmentation supplies the
 * tables, columns and functions introduced by migration 00000000000005.
 */

type BookingEvent = {
  Row: {
    id: string;
    booking_id: string;
    event_type: string;
    actor_type: string;
    actor_id: string | null;
    actor_role: string | null;
    metadata: GeneratedJson | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    booking_id: string;
    event_type: string;
    actor_type: string;
    actor_id?: string | null;
    actor_role?: string | null;
    metadata?: GeneratedJson | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    booking_id?: string;
    event_type?: string;
    actor_type?: string;
    actor_id?: string | null;
    actor_role?: string | null;
    metadata?: GeneratedJson | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: 'booking_events_booking_id_fkey';
      columns: ['booking_id'];
      isOneToOne: false;
      referencedRelation: 'bookings';
      referencedColumns: ['id'];
    },
  ];
};

type BookingCancellationToken = {
  Row: {
    id: string;
    booking_id: string;
    token_hash: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    booking_id: string;
    token_hash: string;
    expires_at: string;
    used_at?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    booking_id?: string;
    token_hash?: string;
    expires_at?: string;
    used_at?: string | null;
    created_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: 'booking_cancellation_tokens_booking_id_fkey';
      columns: ['booking_id'];
      isOneToOne: false;
      referencedRelation: 'bookings';
      referencedColumns: ['id'];
    },
  ];
};

type StripeEvent = {
  Row: {
    id: string;
    event_id: string;
    event_type: string;
    processed_at: string;
    created_at: string;
  };
  Insert: {
    id?: string;
    event_id: string;
    event_type: string;
    processed_at?: string;
    created_at?: string;
  };
  Update: {
    id?: string;
    event_id?: string;
    event_type?: string;
    processed_at?: string;
    created_at?: string;
  };
  Relationships: [];
};

type BookingEmail = {
  Row: {
    id: string;
    booking_id: string;
    email_type: string;
    status: string;
    provider_message_id: string | null;
    error_message: string | null;
    sent_at: string | null;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    booking_id: string;
    email_type: string;
    status: string;
    provider_message_id?: string | null;
    error_message?: string | null;
    sent_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    booking_id?: string;
    email_type?: string;
    status?: string;
    provider_message_id?: string | null;
    error_message?: string | null;
    sent_at?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: 'booking_emails_booking_id_fkey';
      columns: ['booking_id'];
      isOneToOne: false;
      referencedRelation: 'bookings';
      referencedColumns: ['id'];
    },
  ];
};

type Phase5Tables = {
  booking_events: BookingEvent;
  booking_cancellation_tokens: BookingCancellationToken;
  stripe_events: StripeEvent;
  booking_emails: BookingEmail;
  bookings: {
    Row: GeneratedDatabase['public']['Tables']['bookings']['Row'] & {
      cancelled_by: string | null;
      cancellation_reason: string | null;
      moved_from_session_id: string | null;
      moved_to_session_id: string | null;
    };
    Insert: GeneratedDatabase['public']['Tables']['bookings']['Insert'] & {
      cancelled_by?: string | null;
      cancellation_reason?: string | null;
      moved_from_session_id?: string | null;
      moved_to_session_id?: string | null;
    };
    Update: GeneratedDatabase['public']['Tables']['bookings']['Update'] & {
      cancelled_by?: string | null;
      cancellation_reason?: string | null;
      moved_from_session_id?: string | null;
      moved_to_session_id?: string | null;
    };
    Relationships: GeneratedDatabase['public']['Tables']['bookings']['Relationships'];
  };
  payments: {
    Row: GeneratedDatabase['public']['Tables']['payments']['Row'] & {
      refund_reason: string | null;
    };
    Insert: GeneratedDatabase['public']['Tables']['payments']['Insert'] & {
      refund_reason?: string | null;
    };
    Update: GeneratedDatabase['public']['Tables']['payments']['Update'] & {
      refund_reason?: string | null;
    };
    Relationships: GeneratedDatabase['public']['Tables']['payments']['Relationships'];
  };
};

type Phase5Functions = {
  begin_booking: {
    Args: {
      p_session_id: string;
      p_quantity: number;
      p_customer_email: string;
      p_customer_first_name: string;
      p_customer_last_name: string;
      p_customer_phone: string;
      p_customer_notes: string;
      p_marketing_consent: boolean;
      p_terms_accepted_at: string;
      p_privacy_policy_version: string;
      p_participants: GeneratedJson;
      p_source: string;
      p_payment_provider: string;
      p_payment_status: string;
      p_admin_user_id?: string | null;
      p_internal_notes?: string | null;
      p_status?: string;
    };
    Returns: GeneratedJson;
  };
  expire_pending_bookings: {
    Args: never;
    Returns: GeneratedJson;
  };
  confirm_booking_from_payment: {
    Args: {
      p_booking_id: string;
      p_payment_id: string;
      p_stripe_event_id: string;
      p_provider_payment_id: string | null;
      p_amount_gross_grosz: number;
    };
    Returns: GeneratedJson;
  };
  cancel_booking: {
    Args: {
      p_booking_id: string;
      p_cancelled_by: string;
      p_reason: string;
      p_actor_id?: string | null;
      p_actor_role?: string | null;
    };
    Returns: GeneratedJson;
  };
  record_payment_refund: {
    Args: {
      p_payment_id: string;
      p_refund_amount_grosz: number;
      p_reason: string;
    };
    Returns: GeneratedJson;
  };
  move_booking: {
    Args: {
      p_booking_id: string;
      p_destination_session_id: string;
      p_actor_id: string;
      p_actor_role: string;
    };
    Returns: GeneratedJson;
  };
  create_cancellation_token: {
    Args: {
      p_booking_id: string;
      p_expires_at: string;
    };
    Returns: string;
  };
  verify_cancellation_token: {
    Args: {
      p_booking_id: string;
      p_token: string;
    };
    Returns: boolean;
  };
  record_booking_email: {
    Args: {
      p_booking_id: string;
      p_email_type: string;
      p_status: string;
      p_provider_message_id?: string | null;
      p_error_message?: string | null;
    };
    Returns: string;
  };
};

export type Database = GeneratedDatabase & {
  public: {
    Tables: Phase5Tables;
    Functions: Phase5Functions;
  };
};

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
export type DbBookingEvent =
  Database['public']['Tables']['booking_events']['Row'];
export type DbBookingCancellationToken =
  Database['public']['Tables']['booking_cancellation_tokens']['Row'];
export type DbStripeEvent =
  Database['public']['Tables']['stripe_events']['Row'];
export type DbBookingEmail =
  Database['public']['Tables']['booking_emails']['Row'];

// Supabase type generator does not preserve nullability for function arguments,
// so the generated args are stricter than the actual database function. The
// underlying function accepts nulls for all nullable parameters. Cast at the
// RPC call site is therefore a generator-workaround, not a schema mismatch.
export type UpsertWorkshopWithRelationsArgs =
  Database['public']['Functions']['upsert_workshop_with_relations']['Args'];

export type BeginBookingArgs =
  Database['public']['Functions']['begin_booking']['Args'];
export type BeginBookingReturn =
  Database['public']['Functions']['begin_booking']['Returns'];
