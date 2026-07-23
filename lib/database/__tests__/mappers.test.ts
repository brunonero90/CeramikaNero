import { describe, expect, it } from 'vitest';
import {
  mapCategory,
  mapWorkshop,
  mapWorkshopSession,
  mapPublicSiteSettings,
} from '@/lib/database/mappers';
import type {
  DbWorkshopCategory,
  DbWorkshop,
  DbWorkshopSession,
  DbSiteSetting,
} from '@/lib/database/types';

describe('database mapping functions', () => {
  it('maps a category row to a domain category', () => {
    const row: DbWorkshopCategory = {
      id: 'cat-1',
      name: 'Dla dzieci',
      slug: 'dla-dzieci',
      description: null,
      suggested_theme: 'joyful',
      display_order: 10,
      is_visible: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const category = mapCategory(row);
    expect(category.suggestedTheme).toBe('joyful');
    expect(category.displayOrder).toBe(10);
  });

  it('maps a workshop row to a domain workshop', () => {
    const row: DbWorkshop = {
      id: 'ws-1',
      category_id: 'cat-1',
      title: 'Test workshop',
      slug: 'test-workshop',
      short_description: 'Short',
      description: 'Long',
      practical_information: null,
      minimum_age: 6,
      maximum_age: 10,
      default_duration_minutes: 90,
      default_capacity: 10,
      default_price_gross_grosz: 12000,
      currency: 'PLN',
      suggested_theme: 'atelier',
      featured_media_id: null,
      booking_mode: 'scheduled',
      external_booking_url: null,
      status: 'published',
      is_featured: false,
      seo_title: null,
      seo_description: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      archived_at: null,
    };

    const workshop = mapWorkshop(row);
    expect(workshop.title).toBe('Test workshop');
    expect(workshop.defaultPriceGrossGrosz).toBe(12000);
    expect(workshop.suggestedTheme).toBe('atelier');
  });

  it('maps a session row to a domain session', () => {
    const row: DbWorkshopSession = {
      id: 'sess-1',
      workshop_id: 'ws-1',
      instructor_id: null,
      starts_at: '2026-08-05T17:00:00.000Z',
      ends_at: '2026-08-05T19:30:00.000Z',
      timezone: 'Europe/Warsaw',
      capacity: 12,
      reserved_count: 3,
      price_gross_grosz: 18000,
      currency: 'PLN',
      location_name: 'Studio',
      location_address: null,
      status: 'scheduled',
      booking_opens_at: null,
      booking_closes_at: null,
      external_booking_url: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const session = mapWorkshopSession(row);
    expect(session.reservedCount).toBe(3);
    expect(session.capacity).toBe(12);
  });

  it('maps site settings to public settings with fallbacks', () => {
    const rows: DbSiteSetting[] = [
      {
        key: 'studio_name',
        value: 'Ceramika Nero',
        description: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        key: 'unknown_key',
        value: 'ignored',
        description: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    const settings = mapPublicSiteSettings(rows);
    expect(settings.studioName).toBe('Ceramika Nero');
    expect(settings.bookingCtaLabel).toBe('Zarezerwuj warsztat');
  });
});
