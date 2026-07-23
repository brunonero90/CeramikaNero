import { z } from 'zod';
import { THEMES } from '@/lib/types/theme';

export const themeSchema = z.enum(THEMES);

export const contentStatusSchema = z.enum(['draft', 'published', 'archived']);

export const bookingModeSchema = z.enum(['scheduled', 'enquiry', 'external']);

export const sessionStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sold_out',
  'cancelled',
  'completed',
]);

export const bookingStatusSchema = z.enum([
  'pending',
  'awaiting_payment',
  'confirmed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
]);

export const participantTypeSchema = z.enum(['adult', 'child', 'unspecified']);

export const paymentStatusSchema = z.enum([
  'created',
  'pending',
  'paid',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
]);

export const mediaSourceSchema = z.enum(['upload', 'wix_import', 'generated']);

export const mediaRoleSchema = z.enum(['featured', 'gallery', 'detail']);

export const subscriberStatusSchema = z.enum([
  'subscribed',
  'unsubscribed',
  'suppressed',
]);

export const bookingSourceSchema = z.enum(['website', 'admin', 'wix_import']);

export const adminRoleSchema = z.enum(['owner', 'manager', 'editor']);

export const redirectStatusCodeSchema = z.union([
  z.literal(301),
  z.literal(308),
]);

export const legacyRedirectSchema = z
  .object({
    sourcePath: z.string().min(1),
    destinationPath: z.string().min(1),
    statusCode: redirectStatusCodeSchema,
  })
  .refine((data) => data.sourcePath !== data.destinationPath, {
    message: 'Redirect source and destination must be different',
    path: ['destinationPath'],
  });

export type LegacyRedirectInput = z.infer<typeof legacyRedirectSchema>;

export const siteSettingValueSchema = z.record(z.unknown());

export const publicSiteSettingsSchema = z.object({
  studioName: z.string(),
  studioAddress: z.string(),
  studioEmail: z.string().email(),
  studioPhone: z.string(),
  bookingCtaLabel: z.string(),
  defaultSeoTitle: z.string(),
  defaultSeoDescription: z.string(),
});

export const workshopSessionInputSchema = z.object({
  workshopId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().min(1),
  capacity: z.number().int().positive(),
  priceGrossGrosz: z.number().int().nonnegative(),
  locationName: z.string().optional(),
  locationAddress: z.string().optional(),
});

export const workshopFilterSchema = z.object({
  categorySlug: z.string().optional(),
  bookingMode: bookingModeSchema.optional(),
  isFeatured: z.boolean().optional(),
  status: contentStatusSchema.optional(),
});

export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, numbers and hyphens only',
  });
