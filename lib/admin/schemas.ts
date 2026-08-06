import { z } from 'zod';
import {
  themeSchema,
  contentStatusSchema,
  bookingModeSchema,
  sessionStatusSchema,
  redirectStatusCodeSchema,
  slugSchema,
  adminRoleSchema,
} from '@/lib/database/schema';
import { zlotyToGrosz } from '@/lib/utils/money';

export const categoryInputSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(2000).optional().nullable(),
  suggestedTheme: themeSchema,
  displayOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export const workshopInputSchema = z
  .object({
    categoryId: z.string().uuid(),
    title: z.string().min(1).max(300),
    slug: slugSchema,
    shortDescription: z.string().max(1000).optional().nullable(),
    description: z.string().max(20000).optional().nullable(),
    practicalInformation: z.string().max(5000).optional().nullable(),
    minimumAge: z.number().int().min(0).max(120).optional().nullable(),
    maximumAge: z.number().int().min(0).max(120).optional().nullable(),
    participantAudience: z.enum(['adult', 'child', 'mixed']).default('adult'),
    collectParticipantAge: z.boolean().default(false),
    workshopType: z.string().trim().min(1).max(120).default('workshop'),
    requiresFollowupSession: z.boolean().default(false),
    followupWorkshopType: z.string().trim().max(120).optional().nullable(),
    followupMinDays: z.number().int().min(0).max(365).optional().nullable(),
    followupMaxDays: z.number().int().min(0).max(365).optional().nullable(),
    defaultDurationMinutes: z.number().int().min(1).max(1440),
    defaultCapacity: z.number().int().min(1),
    defaultPriceGrossPln: z.number().nonnegative().transform(zlotyToGrosz),
    suggestedTheme: themeSchema.optional().nullable(),
    bookingMode: bookingModeSchema,
    externalBookingUrl: z.string().url().max(2000).optional().nullable(),
    status: contentStatusSchema,
    isFeatured: z.boolean().default(false),
    seoTitle: z.string().max(200).optional().nullable(),
    seoDescription: z.string().max(500).optional().nullable(),
    featuredMediaId: z.string().uuid().optional().nullable(),
    instructorIds: z.array(z.string().uuid()).default([]),
    galleryMedia: z
      .array(
        z.object({
          mediaAssetId: z.string().uuid(),
          role: z.enum(['gallery', 'detail']),
        })
      )
      .default([]),
  })
  .refine(
    (data) => {
      if (data.minimumAge != null && data.maximumAge != null) {
        return data.minimumAge <= data.maximumAge;
      }
      return true;
    },
    {
      message: 'Wiek minimalny nie może przekraczać wieku maksymalnego.',
      path: ['maximumAge'],
    }
  )
  .refine(
    (data) =>
      !data.requiresFollowupSession || Boolean(data.followupWorkshopType),
    {
      message: 'Podaj typ lub slug warsztatu drugiego etapu.',
      path: ['followupWorkshopType'],
    }
  )
  .refine(
    (data) =>
      data.followupMinDays == null ||
      data.followupMaxDays == null ||
      data.followupMinDays <= data.followupMaxDays,
    {
      message: 'Maksymalna liczba dni nie może być mniejsza od minimalnej.',
      path: ['followupMaxDays'],
    }
  )
  .refine(
    (data) => {
      if (data.bookingMode === 'external') {
        return Boolean(data.externalBookingUrl);
      }
      return true;
    },
    {
      message: 'Adres URL zewnętrznej rezerwacji jest wymagany dla tego trybu.',
      path: ['externalBookingUrl'],
    }
  )
  .refine(
    (data) => {
      if (data.status === 'published') {
        return Boolean(data.categoryId && data.title && data.description);
      }
      return true;
    },
    {
      message: 'Opublikowany warsztat wymaga kategorii, tytułu i opisu.',
      path: ['description'],
    }
  );

export const sessionInputSchema = z
  .object({
    workshopId: z.string().uuid(),
    instructorId: z.string().uuid().optional().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().min(1).max(100),
    capacity: z.number().int().min(1),
    priceGrossPln: z.number().nonnegative().transform(zlotyToGrosz),
    venueKey: z
      .enum(['suchy-las', 'ptasie-radio', 'other'])
      .optional()
      .nullable(),
    locationName: z.string().max(300).optional().nullable(),
    locationAddress: z.string().max(500).optional().nullable(),
    status: sessionStatusSchema,
    bookingOpensAt: z.string().datetime().optional().nullable(),
    bookingClosesAt: z.string().datetime().optional().nullable(),
    externalBookingUrl: z.string().url().max(2000).optional().nullable(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: 'Czas zakończenia musi być późniejszy niż rozpoczęcia.',
    path: ['endsAt'],
  })
  .refine(
    (data) => {
      if (data.bookingOpensAt && data.bookingClosesAt) {
        return new Date(data.bookingOpensAt) <= new Date(data.bookingClosesAt);
      }
      return true;
    },
    {
      message: 'Otwarcie zapisów musi nastąpić przed zamknięciem.',
      path: ['bookingClosesAt'],
    }
  );

export const instructorInputSchema = z.object({
  displayName: z.string().min(1).max(200),
  slug: slugSchema,
  biography: z.string().max(5000).optional().nullable(),
  profileMediaId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export const pageInputSchema = z.object({
  title: z.string().min(1).max(300),
  slug: slugSchema,
  excerpt: z.string().max(2000).optional().nullable(),
  content: z.string().max(200000).optional().nullable(),
  status: contentStatusSchema,
  suggestedTheme: themeSchema.optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
});

export const blogPostInputSchema = z.object({
  title: z.string().min(1).max(300),
  slug: slugSchema,
  excerpt: z.string().min(1).max(2000),
  content: z.string().min(1).max(50000),
  featuredMediaId: z.string().uuid().optional().nullable(),
  status: contentStatusSchema,
  authorName: z.string().max(200).optional().nullable(),
  publishedAt: z.string().datetime().optional().nullable(),
  seoTitle: z.string().max(200).optional().nullable(),
  seoDescription: z.string().max(500).optional().nullable(),
  legacyWixUrl: z.string().url().max(2000).optional().nullable(),
});

export const galleryItemInputSchema = z.object({
  mediaAssetId: z.string().uuid(),
  title: z.string().max(300).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(200).optional().nullable(),
  displayOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export const siteSettingsInputSchema = z.object({
  studioName: z.string().min(1).max(200),
  studioAddress: z.string().max(500),
  studioEmail: z.string().email().max(200),
  studioPhone: z.string().max(100),
  whatsappUrl: z
    .string()
    .max(500)
    .refine(
      (v) => v === '' || /^https?:\/\//i.test(v),
      'Podaj pełny URL WhatsApp (https://…) albo zostaw puste.'
    ),
  facebookUrl: z
    .string()
    .max(500)
    .refine(
      (v) => v === '' || /^https?:\/\//i.test(v),
      'Podaj pełny URL Facebook (https://…) albo zostaw puste.'
    ),
  instagramUrl: z
    .string()
    .max(500)
    .refine(
      (v) => v === '' || /^https?:\/\//i.test(v),
      'Podaj pełny URL Instagram (https://…) albo zostaw puste.'
    ),
  bankTransferInstructions: z.string().max(2000),
  bankTransferEnabled: z.boolean().default(true),
  bankTransferRecipient: z.string().max(200),
  bankTransferAccount: z.string().max(40),
  bankTransferBankName: z.string().max(120),
  bankTransferTitleTemplate: z.string().max(200),
  bankTransferDeadlineNote: z.string().max(500),
  deliveryQuoteWording: z.string().max(500),
  publicNotice: z.string().max(1000),
  bookingCtaLabel: z.string().max(200),
  defaultSeoTitle: z.string().max(200),
  defaultSeoDescription: z.string().max(500),
});

export const redirectInputSchema = z
  .object({
    sourcePath: z.string().min(1).max(500),
    destinationPath: z.string().min(1).max(500),
    statusCode: redirectStatusCodeSchema,
  })
  .refine((data) => data.sourcePath !== data.destinationPath, {
    message: 'Ścieżka źródłowa i docelowa muszą się różnić.',
    path: ['destinationPath'],
  })
  .refine(
    (data) =>
      data.sourcePath.startsWith('/') && data.destinationPath.startsWith('/'),
    {
      message: 'Ścieżki muszą zaczynać się od „/”.',
      path: ['destinationPath'],
    }
  );

export const adminUserInputSchema = z.object({
  userId: z.string().uuid(),
  role: adminRoleSchema,
  displayName: z.string().min(1).max(200),
  isActive: z.boolean().default(true),
});

export const adminUserRoleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: adminRoleSchema,
  isActive: z.boolean(),
});
