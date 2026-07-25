export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          actor_role: string;
          actor_user_id: string;
          changed_fields: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          request_metadata: Json | null;
          summary: string;
        };
        Insert: {
          action: string;
          actor_role: string;
          actor_user_id: string;
          changed_fields?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          request_metadata?: Json | null;
          summary: string;
        };
        Update: {
          action?: string;
          actor_role?: string;
          actor_user_id?: string;
          changed_fields?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          request_metadata?: Json | null;
          summary?: string;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          created_at: string;
          display_name: string;
          is_active: boolean;
          last_login_at: string | null;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          is_active?: boolean;
          last_login_at?: string | null;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          is_active?: boolean;
          last_login_at?: string | null;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      blog_posts: {
        Row: {
          archived_at: string | null;
          author_name: string | null;
          content: string;
          created_at: string;
          excerpt: string;
          featured_media_id: string | null;
          id: string;
          legacy_wix_url: string | null;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          author_name?: string | null;
          content: string;
          created_at?: string;
          excerpt: string;
          featured_media_id?: string | null;
          id?: string;
          legacy_wix_url?: string | null;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          author_name?: string | null;
          content?: string;
          created_at?: string;
          excerpt?: string;
          featured_media_id?: string | null;
          id?: string;
          legacy_wix_url?: string | null;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blog_posts_featured_media_id_fkey';
            columns: ['featured_media_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_cancellation_tokens: {
        Row: {
          booking_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          token_hash?: string;
          used_at?: string | null;
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
      booking_emails: {
        Row: {
          booking_id: string;
          created_at: string;
          email_type: string;
          error_message: string | null;
          id: string;
          provider_message_id: string | null;
          sent_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          email_type: string;
          error_message?: string | null;
          id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          email_type?: string;
          error_message?: string | null;
          id?: string;
          provider_message_id?: string | null;
          sent_at?: string | null;
          status?: string;
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
      booking_events: {
        Row: {
          actor_id: string | null;
          actor_role: string | null;
          actor_type: string;
          booking_id: string;
          created_at: string;
          event_type: string;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_role?: string | null;
          actor_type: string;
          booking_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: string | null;
          actor_type?: string;
          booking_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          metadata?: Json | null;
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
      booking_participants: {
        Row: {
          accessibility_notes: string | null;
          age: number | null;
          booking_id: string;
          created_at: string;
          display_name: string | null;
          id: string;
          participant_type: string;
          updated_at: string;
        };
        Insert: {
          accessibility_notes?: string | null;
          age?: number | null;
          booking_id: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          participant_type: string;
          updated_at?: string;
        };
        Update: {
          accessibility_notes?: string | null;
          age?: number | null;
          booking_id?: string;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          participant_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_participants_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          booking_reference: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          customer_id: string;
          customer_notes: string | null;
          expires_at: string | null;
          id: string;
          internal_notes: string | null;
          moved_from_session_id: string | null;
          moved_to_session_id: string | null;
          privacy_policy_version: string;
          quantity: number;
          source: string;
          status: string;
          terms_accepted_at: string;
          total_price_gross_grosz: number;
          unit_price_gross_grosz: number;
          updated_at: string;
          workshop_session_id: string;
        };
        Insert: {
          booking_reference: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_id: string;
          customer_notes?: string | null;
          expires_at?: string | null;
          id?: string;
          internal_notes?: string | null;
          moved_from_session_id?: string | null;
          moved_to_session_id?: string | null;
          privacy_policy_version: string;
          quantity: number;
          source: string;
          status: string;
          terms_accepted_at: string;
          total_price_gross_grosz: number;
          unit_price_gross_grosz: number;
          updated_at?: string;
          workshop_session_id: string;
        };
        Update: {
          booking_reference?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          customer_notes?: string | null;
          expires_at?: string | null;
          id?: string;
          internal_notes?: string | null;
          moved_from_session_id?: string | null;
          moved_to_session_id?: string | null;
          privacy_policy_version?: string;
          quantity?: number;
          source?: string;
          status?: string;
          terms_accepted_at?: string;
          total_price_gross_grosz?: number;
          unit_price_gross_grosz?: number;
          updated_at?: string;
          workshop_session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customer_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_moved_from_session_id_fkey';
            columns: ['moved_from_session_id'];
            isOneToOne: false;
            referencedRelation: 'workshop_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_moved_to_session_id_fkey';
            columns: ['moved_to_session_id'];
            isOneToOne: false;
            referencedRelation: 'workshop_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_workshop_session_id_fkey';
            columns: ['workshop_session_id'];
            isOneToOne: false;
            referencedRelation: 'workshop_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      content_pages: {
        Row: {
          archived_at: string | null;
          content: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: string;
          suggested_theme: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          content?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status: string;
          suggested_theme?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          content?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: string;
          suggested_theme?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          archived_at: string | null;
          auth_user_id: string | null;
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          marketing_consent: boolean;
          marketing_consent_at: string | null;
          phone: string | null;
          preferred_language: string;
          privacy_policy_version: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          phone?: string | null;
          preferred_language?: string;
          privacy_policy_version?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          auth_user_id?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          phone?: string | null;
          preferred_language?: string;
          privacy_policy_version?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery_items: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          is_visible: boolean;
          media_asset_id: string;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_visible?: boolean;
          media_asset_id: string;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_visible?: boolean;
          media_asset_id?: string;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gallery_items_media_asset_id_fkey';
            columns: ['media_asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
      instructors: {
        Row: {
          biography: string | null;
          created_at: string;
          display_name: string;
          display_order: number;
          id: string;
          is_active: boolean;
          profile_media_id: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          biography?: string | null;
          created_at?: string;
          display_name: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          profile_media_id?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          biography?: string | null;
          created_at?: string;
          display_name?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          profile_media_id?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'instructors_profile_media_id_fkey';
            columns: ['profile_media_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
      legacy_redirects: {
        Row: {
          created_at: string;
          destination_path: string;
          id: string;
          notes: string | null;
          source_path: string;
          status_code: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          destination_path: string;
          id?: string;
          notes?: string | null;
          source_path: string;
          status_code: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          destination_path?: string;
          id?: string;
          notes?: string | null;
          source_path?: string;
          status_code?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          alt_text: string;
          archived_at: string | null;
          caption: string | null;
          checksum: string | null;
          created_at: string;
          file_size_bytes: number | null;
          height: number | null;
          id: string;
          mime_type: string;
          original_filename: string;
          source: string;
          storage_bucket: string;
          storage_path: string;
          updated_at: string;
          width: number | null;
          wix_url: string | null;
        };
        Insert: {
          alt_text?: string;
          archived_at?: string | null;
          caption?: string | null;
          checksum?: string | null;
          created_at?: string;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          mime_type: string;
          original_filename: string;
          source: string;
          storage_bucket: string;
          storage_path: string;
          updated_at?: string;
          width?: number | null;
          wix_url?: string | null;
        };
        Update: {
          alt_text?: string;
          archived_at?: string | null;
          caption?: string | null;
          checksum?: string | null;
          created_at?: string;
          file_size_bytes?: number | null;
          height?: number | null;
          id?: string;
          mime_type?: string;
          original_filename?: string;
          source?: string;
          storage_bucket?: string;
          storage_path?: string;
          updated_at?: string;
          width?: number | null;
          wix_url?: string | null;
        };
        Relationships: [];
      };
      newsletter_subscribers: {
        Row: {
          consent_at: string;
          consent_source: string;
          created_at: string;
          email: string;
          id: string;
          privacy_policy_version: string;
          status: string;
          unsubscribed_at: string | null;
          updated_at: string;
        };
        Insert: {
          consent_at: string;
          consent_source: string;
          created_at?: string;
          email: string;
          id?: string;
          privacy_policy_version: string;
          status: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Update: {
          consent_at?: string;
          consent_source?: string;
          created_at?: string;
          email?: string;
          id?: string;
          privacy_policy_version?: string;
          status?: string;
          unsubscribed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount_gross_grosz: number;
          booking_id: string;
          created_at: string;
          currency: string;
          failure_code: string | null;
          failure_message: string | null;
          id: string;
          idempotency_key: string | null;
          paid_at: string | null;
          provider: string;
          provider_checkout_id: string | null;
          provider_payment_id: string | null;
          raw_provider_reference: string | null;
          refund_reason: string | null;
          refunded_amount_grosz: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_gross_grosz: number;
          booking_id: string;
          created_at?: string;
          currency?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string | null;
          paid_at?: string | null;
          provider: string;
          provider_checkout_id?: string | null;
          provider_payment_id?: string | null;
          raw_provider_reference?: string | null;
          refund_reason?: string | null;
          refunded_amount_grosz?: number;
          status: string;
          updated_at?: string;
        };
        Update: {
          amount_gross_grosz?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          failure_code?: string | null;
          failure_message?: string | null;
          id?: string;
          idempotency_key?: string | null;
          paid_at?: string | null;
          provider?: string;
          provider_checkout_id?: string | null;
          provider_payment_id?: string | null;
          raw_provider_reference?: string | null;
          refund_reason?: string | null;
          refunded_amount_grosz?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      site_settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          created_at: string;
          event_id: string;
          event_type: string;
          id: string;
          processed_at: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: string;
          processed_at?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      workshop_categories: {
        Row: {
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          is_visible: boolean;
          name: string;
          slug: string;
          suggested_theme: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_visible?: boolean;
          name: string;
          slug: string;
          suggested_theme: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          is_visible?: boolean;
          name?: string;
          slug?: string;
          suggested_theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workshop_instructors: {
        Row: {
          display_order: number;
          instructor_id: string;
          workshop_id: string;
        };
        Insert: {
          display_order?: number;
          instructor_id: string;
          workshop_id: string;
        };
        Update: {
          display_order?: number;
          instructor_id?: string;
          workshop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workshop_instructors_instructor_id_fkey';
            columns: ['instructor_id'];
            isOneToOne: false;
            referencedRelation: 'instructors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workshop_instructors_workshop_id_fkey';
            columns: ['workshop_id'];
            isOneToOne: false;
            referencedRelation: 'workshops';
            referencedColumns: ['id'];
          },
        ];
      };
      workshop_media: {
        Row: {
          display_order: number;
          media_asset_id: string;
          role: string;
          workshop_id: string;
        };
        Insert: {
          display_order?: number;
          media_asset_id: string;
          role: string;
          workshop_id: string;
        };
        Update: {
          display_order?: number;
          media_asset_id?: string;
          role?: string;
          workshop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workshop_media_media_asset_id_fkey';
            columns: ['media_asset_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workshop_media_workshop_id_fkey';
            columns: ['workshop_id'];
            isOneToOne: false;
            referencedRelation: 'workshops';
            referencedColumns: ['id'];
          },
        ];
      };
      workshop_sessions: {
        Row: {
          booking_closes_at: string | null;
          booking_opens_at: string | null;
          capacity: number;
          created_at: string;
          currency: string;
          ends_at: string;
          external_booking_url: string | null;
          id: string;
          instructor_id: string | null;
          location_address: string | null;
          location_name: string | null;
          price_gross_grosz: number;
          reserved_count: number;
          starts_at: string;
          status: string;
          timezone: string;
          updated_at: string;
          workshop_id: string;
        };
        Insert: {
          booking_closes_at?: string | null;
          booking_opens_at?: string | null;
          capacity: number;
          created_at?: string;
          currency?: string;
          ends_at: string;
          external_booking_url?: string | null;
          id?: string;
          instructor_id?: string | null;
          location_address?: string | null;
          location_name?: string | null;
          price_gross_grosz: number;
          reserved_count?: number;
          starts_at: string;
          status: string;
          timezone?: string;
          updated_at?: string;
          workshop_id: string;
        };
        Update: {
          booking_closes_at?: string | null;
          booking_opens_at?: string | null;
          capacity?: number;
          created_at?: string;
          currency?: string;
          ends_at?: string;
          external_booking_url?: string | null;
          id?: string;
          instructor_id?: string | null;
          location_address?: string | null;
          location_name?: string | null;
          price_gross_grosz?: number;
          reserved_count?: number;
          starts_at?: string;
          status?: string;
          timezone?: string;
          updated_at?: string;
          workshop_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workshop_sessions_instructor_id_fkey';
            columns: ['instructor_id'];
            isOneToOne: false;
            referencedRelation: 'instructors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workshop_sessions_workshop_id_fkey';
            columns: ['workshop_id'];
            isOneToOne: false;
            referencedRelation: 'workshops';
            referencedColumns: ['id'];
          },
        ];
      };
      workshops: {
        Row: {
          archived_at: string | null;
          booking_mode: string;
          category_id: string;
          created_at: string;
          currency: string;
          default_capacity: number;
          default_duration_minutes: number;
          default_price_gross_grosz: number;
          description: string | null;
          external_booking_url: string | null;
          featured_media_id: string | null;
          id: string;
          is_featured: boolean;
          maximum_age: number | null;
          minimum_age: number | null;
          practical_information: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          status: string;
          suggested_theme: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          booking_mode: string;
          category_id: string;
          created_at?: string;
          currency?: string;
          default_capacity: number;
          default_duration_minutes: number;
          default_price_gross_grosz: number;
          description?: string | null;
          external_booking_url?: string | null;
          featured_media_id?: string | null;
          id?: string;
          is_featured?: boolean;
          maximum_age?: number | null;
          minimum_age?: number | null;
          practical_information?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug: string;
          status: string;
          suggested_theme?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          booking_mode?: string;
          category_id?: string;
          created_at?: string;
          currency?: string;
          default_capacity?: number;
          default_duration_minutes?: number;
          default_price_gross_grosz?: number;
          description?: string | null;
          external_booking_url?: string | null;
          featured_media_id?: string | null;
          id?: string;
          is_featured?: boolean;
          maximum_age?: number | null;
          minimum_age?: number | null;
          practical_information?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug?: string;
          status?: string;
          suggested_theme?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workshops_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'workshop_categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workshops_featured_media_id_fkey';
            columns: ['featured_media_id'];
            isOneToOne: false;
            referencedRelation: 'media_assets';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      begin_booking: {
        Args: {
          p_admin_user_id?: string;
          p_customer_email: string;
          p_customer_first_name: string;
          p_customer_last_name: string;
          p_customer_notes: string;
          p_customer_phone: string;
          p_idempotency_key?: string;
          p_internal_notes?: string;
          p_marketing_consent: boolean;
          p_participants: Json;
          p_payment_provider: string;
          p_payment_status: string;
          p_privacy_policy_version: string;
          p_quantity: number;
          p_session_id: string;
          p_source: string;
          p_status?: string;
          p_terms_accepted_at: string;
        };
        Returns: Json;
      };
      cancel_booking: {
        Args: {
          p_actor_id?: string;
          p_actor_role?: string;
          p_booking_id: string;
          p_cancelled_by: string;
          p_reason: string;
        };
        Returns: Json;
      };
      confirm_booking_from_payment: {
        Args: {
          p_amount_gross_grosz: number;
          p_booking_id: string;
          p_payment_id: string;
          p_provider_payment_id: string;
          p_stripe_event_id: string;
        };
        Returns: Json;
      };
      create_cancellation_token: {
        Args: { p_booking_id: string; p_expires_at: string };
        Returns: string;
      };
      current_admin_role: { Args: never; Returns: string };
      expire_pending_bookings: {
        Args: never;
        Returns: {
          booking_id: string;
          booking_reference: string;
        }[];
      };
      is_active_admin: { Args: never; Returns: boolean };
      is_admin_role: { Args: { required_role: string }; Returns: boolean };
      move_booking: {
        Args: {
          p_actor_id: string;
          p_actor_role: string;
          p_booking_id: string;
          p_destination_session_id: string;
        };
        Returns: Json;
      };
      record_booking_email: {
        Args: {
          p_booking_id: string;
          p_email_type: string;
          p_error_message?: string;
          p_provider_message_id?: string;
          p_status: string;
        };
        Returns: string;
      };
      record_payment_refund: {
        Args: {
          p_payment_id: string;
          p_reason: string;
          p_refund_amount_grosz: number;
        };
        Returns: Json;
      };
      upsert_workshop_with_relations: {
        Args: {
          p_booking_mode: string;
          p_category_id: string;
          p_default_capacity: number;
          p_default_duration_minutes: number;
          p_default_price_gross_grosz: number;
          p_description: string;
          p_external_booking_url: string;
          p_featured_media_id: string;
          p_gallery_media: Json;
          p_instructor_ids: string[];
          p_is_featured: boolean;
          p_maximum_age: number;
          p_minimum_age: number;
          p_practical_information: string;
          p_seo_description: string;
          p_seo_title: string;
          p_short_description: string;
          p_slug: string;
          p_status: string;
          p_suggested_theme: string;
          p_title: string;
          p_workshop_id: string;
        };
        Returns: string;
      };
      verify_cancellation_token: {
        Args: { p_booking_id: string; p_token: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
