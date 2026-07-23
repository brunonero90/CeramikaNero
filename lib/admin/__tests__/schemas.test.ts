import { describe, expect, it } from 'vitest';
import {
  workshopInputSchema,
  sessionInputSchema,
  instructorInputSchema,
  blogPostInputSchema,
  galleryItemInputSchema,
} from '../schemas';

const categoryId = '550e8400-e29b-41d4-a716-446655440000';

function validWorkshop(overrides: Record<string, unknown> = {}) {
  return {
    categoryId,
    title: 'Test warsztatu',
    slug: 'test-warsztatu',
    defaultDurationMinutes: 60,
    defaultCapacity: 5,
    defaultPriceGrossPln: 120,
    bookingMode: 'scheduled',
    status: 'draft',
    ...overrides,
  };
}

describe('workshopInputSchema', () => {
  it('accepts a valid draft workshop', () => {
    const result = workshopInputSchema.safeParse(validWorkshop());
    expect(result.success).toBe(true);
  });

  it('rejects a workshop with empty title', () => {
    const result = workshopInputSchema.safeParse(validWorkshop({ title: '' }));
    expect(result.success).toBe(false);
  });

  it('requires external booking URL for external mode', () => {
    const result = workshopInputSchema.safeParse(
      validWorkshop({ bookingMode: 'external', externalBookingUrl: null })
    );
    expect(result.success).toBe(false);
  });

  it('accepts external mode with a valid URL', () => {
    const result = workshopInputSchema.safeParse(
      validWorkshop({
        bookingMode: 'external',
        externalBookingUrl: 'https://example.com/book',
      })
    );
    expect(result.success).toBe(true);
  });

  it('rejects minimum age greater than maximum age', () => {
    const result = workshopInputSchema.safeParse(
      validWorkshop({ minimumAge: 10, maximumAge: 5 })
    );
    expect(result.success).toBe(false);
  });

  it('converts price from zloty to grosz', () => {
    const result = workshopInputSchema.safeParse(
      validWorkshop({ defaultPriceGrossPln: 123.45 })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultPriceGrossPln).toBe(12345);
    }
  });
});

describe('sessionInputSchema', () => {
  it('accepts a valid session', () => {
    const result = sessionInputSchema.safeParse({
      workshopId: categoryId,
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T12:00:00.000Z',
      timezone: 'Europe/Warsaw',
      capacity: 10,
      priceGrossPln: 120,
      status: 'scheduled',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a session that ends before it starts', () => {
    const result = sessionInputSchema.safeParse({
      workshopId: categoryId,
      startsAt: '2026-08-01T12:00:00.000Z',
      endsAt: '2026-08-01T10:00:00.000Z',
      timezone: 'Europe/Warsaw',
      capacity: 10,
      priceGrossPln: 120,
      status: 'scheduled',
    });
    expect(result.success).toBe(false);
  });

  it('converts session price from zloty to grosz', () => {
    const result = sessionInputSchema.safeParse({
      workshopId: categoryId,
      startsAt: '2026-08-01T10:00:00.000Z',
      endsAt: '2026-08-01T12:00:00.000Z',
      timezone: 'Europe/Warsaw',
      capacity: 10,
      priceGrossPln: 99.99,
      status: 'scheduled',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceGrossPln).toBe(9999);
    }
  });
});

describe('instructorInputSchema', () => {
  it('accepts a valid instructor', () => {
    const result = instructorInputSchema.safeParse({
      displayName: 'Ania Nero',
      slug: 'ania-nero',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty display name', () => {
    const result = instructorInputSchema.safeParse({
      displayName: '',
      slug: 'ania-nero',
    });
    expect(result.success).toBe(false);
  });
});

describe('blogPostInputSchema', () => {
  it('accepts a valid blog post', () => {
    const result = blogPostInputSchema.safeParse({
      title: 'Pierwsze kroki',
      slug: 'pierwsze-kroki',
      excerpt: 'Wprowadzenie',
      content: 'Treść artykułu.',
      status: 'draft',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty excerpt', () => {
    const result = blogPostInputSchema.safeParse({
      title: 'Pierwsze kroki',
      slug: 'pierwsze-kroki',
      excerpt: '',
      content: 'Treść artykułu.',
      status: 'draft',
    });
    expect(result.success).toBe(false);
  });
});

describe('galleryItemInputSchema', () => {
  it('accepts a valid gallery item', () => {
    const result = galleryItemInputSchema.safeParse({
      mediaAssetId: categoryId,
      title: 'Wazon',
    });
    expect(result.success).toBe(true);
  });
});
