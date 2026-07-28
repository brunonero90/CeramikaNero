import {
  contentStatusSchema,
  sessionStatusSchema,
  bookingStatusSchema,
  participantTypeSchema,
  paymentStatusSchema,
  mediaSourceSchema,
  mediaRoleSchema,
  subscriberStatusSchema,
  bookingSourceSchema,
  redirectStatusCodeSchema,
  themeSchema,
  bookingModeSchema,
} from './schema';
import type {
  DbWorkshopCategory,
  DbInstructor,
  DbMediaAsset,
  DbWorkshop,
  DbWorkshopSession,
  DbContentPage,
  DbBlogPost,
  DbGalleryItem,
  DbLegacyRedirect,
  DbSiteSetting,
  WorkshopCategory,
  Instructor,
  MediaAsset,
  Workshop,
  WorkshopSession,
  ContentPage,
  BlogPost,
  GalleryItem,
  LegacyRedirect,
  SiteSetting,
  PublicSiteSettings,
  BookingStatus,
  ParticipantType,
  PaymentStatus,
  BookingSource,
  SubscriberStatus,
  MediaRole,
  ContentStatus,
} from './types';

export function mapCategory(row: DbWorkshopCategory): WorkshopCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    suggestedTheme: themeSchema.parse(row.suggested_theme),
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  };
}

export function mapInstructor(row: DbInstructor): Instructor {
  return {
    id: row.id,
    displayName: row.display_name,
    slug: row.slug,
    biography: row.biography,
    profileMediaId: row.profile_media_id,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

export function mapMediaAsset(row: DbMediaAsset): MediaAsset {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.file_size_bytes,
    altText: row.alt_text,
    caption: row.caption,
    source: mediaSourceSchema.parse(row.source),
    wixUrl: row.wix_url,
    checksum: row.checksum,
    archivedAt: row.archived_at,
  };
}

export function mapWorkshop(row: DbWorkshop): Workshop {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    description: row.description,
    practicalInformation: row.practical_information,
    minimumAge: row.minimum_age,
    maximumAge: row.maximum_age,
    defaultDurationMinutes: row.default_duration_minutes,
    defaultCapacity: row.default_capacity,
    defaultPriceGrossGrosz: row.default_price_gross_grosz,
    currency: row.currency,
    suggestedTheme: row.suggested_theme
      ? themeSchema.parse(row.suggested_theme)
      : null,
    featuredMediaId: row.featured_media_id,
    bookingMode: bookingModeSchema.parse(row.booking_mode),
    externalBookingUrl: row.external_booking_url,
    status: contentStatusSchema.parse(row.status),
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    archivedAt: row.archived_at,
  };
}

export function mapWorkshopSession(row: DbWorkshopSession): WorkshopSession {
  return {
    id: row.id,
    workshopId: row.workshop_id,
    instructorId: row.instructor_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    capacity: row.capacity,
    reservedCount: row.reserved_count,
    priceGrossGrosz: row.price_gross_grosz,
    currency: row.currency,
    locationName: row.location_name,
    locationAddress: row.location_address,
    venueKey:
      'venue_key' in row
        ? ((row as { venue_key?: string | null }).venue_key ?? null)
        : null,
    status: sessionStatusSchema.parse(row.status),
    bookingOpensAt: row.booking_opens_at,
    bookingClosesAt: row.booking_closes_at,
    externalBookingUrl: row.external_booking_url,
  };
}

export function mapContentPage(row: DbContentPage): ContentPage {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    status: contentStatusSchema.parse(row.status),
    suggestedTheme: row.suggested_theme
      ? themeSchema.parse(row.suggested_theme)
      : null,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

export function mapBlogPost(row: DbBlogPost): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    featuredMediaId: row.featured_media_id,
    status: contentStatusSchema.parse(row.status),
    authorName: row.author_name,
    publishedAt: row.published_at,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    legacyWixUrl: row.legacy_wix_url,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
  };
}

export function mapGalleryItem(row: DbGalleryItem): GalleryItem {
  return {
    id: row.id,
    mediaAssetId: row.media_asset_id,
    title: row.title,
    description: row.description,
    category: row.category,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
    updatedAt: row.updated_at,
  };
}

export function mapLegacyRedirect(row: DbLegacyRedirect): LegacyRedirect {
  return {
    id: row.id,
    sourcePath: row.source_path,
    destinationPath: row.destination_path,
    statusCode: redirectStatusCodeSchema.parse(row.status_code),
    notes: row.notes,
  };
}

export function mapSiteSetting(row: DbSiteSetting): SiteSetting {
  return {
    key: row.key,
    value: row.value,
    description: row.description,
  };
}

export function mapPublicSiteSettings(
  rows: DbSiteSetting[]
): PublicSiteSettings {
  const get = (key: string, fallback: string): string => {
    const found = rows.find((row) => row.key === key);
    return typeof found?.value === 'string' ? found.value : fallback;
  };

  return {
    studioName: get('studio_name', 'Ceramika Nero'),
    studioAddress: get('studio_address', 'Suchy Las, Polska'),
    studioEmail: get('studio_email', 'kontakt@ceramikanero.com'),
    studioPhone: get('studio_phone', '532 279 101'),
    whatsappUrl: get('whatsapp_url', 'https://wa.me/48532279101'),
    facebookUrl: get('facebook_url', 'https://www.facebook.com/ceramikanero'),
    instagramUrl: get(
      'instagram_url',
      'https://www.instagram.com/ceramika_nero'
    ),
    bankTransferInstructions: get(
      'bank_transfer_instructions',
      'Przelew bankowy — dane konta potwierdzimy po ustaleniu finalnej kwoty.'
    ),
    bankTransferEnabled: (() => {
      const raw = get('bank_transfer_enabled', 'true').toLowerCase();
      return raw === 'true' || raw === '1' || raw === 'yes' || raw === '';
    })(),
    bankTransferRecipient: get('bank_transfer_recipient', ''),
    bankTransferAccount: get('bank_transfer_account', ''),
    bankTransferBankName: get('bank_transfer_bank_name', ''),
    bankTransferTitleTemplate: get(
      'bank_transfer_title_template',
      '{{order_reference}}'
    ),
    bankTransferDeadlineNote: get('bank_transfer_deadline_note', ''),
    deliveryQuoteWording: get(
      'delivery_quote_wording',
      'Koszt wysyłki zostanie potwierdzony przed płatnością.'
    ),
    publicNotice: get('public_notice', ''),
    bookingCtaLabel: get('booking_cta_label', 'Zarezerwuj warsztat'),
    defaultSeoTitle: get(
      'default_seo_title',
      'Ceramika Nero — Warsztaty ceramiczne w Suchym Lesie'
    ),
    defaultSeoDescription: get(
      'default_seo_description',
      'Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w naszej pracowni w Suchym Lesie.'
    ),
  };
}

export function toDbStatus(value: ContentStatus): string {
  return contentStatusSchema.parse(value);
}

export function toDbSessionStatus(value: WorkshopSession['status']): string {
  return sessionStatusSchema.parse(value);
}

export function toDbBookingStatus(value: BookingStatus): string {
  return bookingStatusSchema.parse(value);
}

export function toDbParticipantType(value: ParticipantType): string {
  return participantTypeSchema.parse(value);
}

export function toDbPaymentStatus(value: PaymentStatus): string {
  return paymentStatusSchema.parse(value);
}

export function toDbMediaSource(value: MediaAsset['source']): string {
  return mediaSourceSchema.parse(value);
}

export function toDbMediaRole(value: MediaRole): string {
  return mediaRoleSchema.parse(value);
}

export function toDbSubscriberStatus(value: SubscriberStatus): string {
  return subscriberStatusSchema.parse(value);
}

export function toDbBookingSource(value: BookingSource): string {
  return bookingSourceSchema.parse(value);
}
