import { afterEach, describe, expect, it } from 'vitest';
import type { MediaAsset } from '@/lib/database/types';
import { getWorkshopImage } from '../wix-catalog';

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  if (originalSupabaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  }
});

describe('getWorkshopImage', () => {
  it.each([
    [
      'kurs-rysunku-malarstwa-ceramiki-6-10-lat',
      '/images/wix-migrated/747d6f_31092dec535d44fda01b193d542727de.jpg',
    ],
    [
      'kurs-ceramiki-dla-mlodziezy-11',
      '/images/wix-migrated/747d6f_f560d7a2e95a49aebcda0065309a0783.jpg',
    ],
    [
      'wieczory-panienskie',
      '/images/wix-migrated/747d6f_f7dbb82b083943689efa367416eb192a.jpg',
    ],
  ])('provides a catalogue fallback for %s', (slug, expectedSrc) => {
    expect(getWorkshopImage(slug)?.src).toBe(expectedSrc);
  });

  it('prefers the database-selected featured asset over a slug fallback', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    const uploadedAsset: MediaAsset = {
      id: 'f3831606-0b50-4552-af6f-3f1f6c93a816',
      originalFilename: 'course.jpg',
      storageBucket: 'media',
      storagePath: 'originals/2026/07/id/course.jpg',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      fileSizeBytes: 1234,
      altText: 'Nowe zdjęcie kursu',
      caption: null,
      source: 'upload',
      wixUrl: null,
      checksum: null,
      archivedAt: null,
    };

    const image = getWorkshopImage(
      'kurs-ceramiki-dla-mlodziezy-11',
      uploadedAsset,
      uploadedAsset.id
    );

    expect(image).toMatchObject({
      src: 'https://project.supabase.co/storage/v1/object/public/media/originals/2026/07/id/course.jpg',
      alt: 'Nowe zdjęcie kursu',
    });
  });

  it('ignores legacy seed placeholders and uses the real catalogue image', () => {
    const placeholder: MediaAsset = {
      id: '62117418-89f6-4c62-9af0-1b8aa5e9d24f',
      originalFilename: 'placeholders/mlodziez.jpg',
      storageBucket: 'public',
      storagePath: 'placeholders/mlodziez.jpg',
      mimeType: 'image/jpeg',
      width: null,
      height: null,
      fileSizeBytes: null,
      altText: 'Kurs ceramiki dla młodzieży',
      caption: null,
      source: 'generated',
      wixUrl: null,
      checksum: null,
      archivedAt: null,
    };

    expect(
      getWorkshopImage(
        'kurs-ceramiki-dla-mlodziezy-11',
        placeholder,
        placeholder.id
      )?.src
    ).toBe('/images/wix-migrated/747d6f_f560d7a2e95a49aebcda0065309a0783.jpg');
  });
});
