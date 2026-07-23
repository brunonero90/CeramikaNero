import { describe, expect, it } from 'vitest';
import {
  sanitizeFilename,
  generateStoragePath,
  ALLOWED_MEDIA_TYPES,
  MAX_MEDIA_FILE_SIZE_BYTES,
} from '../media';

describe('sanitizeFilename', () => {
  it('removes forbidden characters', () => {
    expect(sanitizeFilename('a<b>:c')).toBe('a_b__c');
  });

  it('trims and collapses whitespace', () => {
    expect(sanitizeFilename('  my   file  ')).toBe('my file');
  });

  it('limits length', () => {
    const long = 'a'.repeat(250);
    expect(sanitizeFilename(long).length).toBe(200);
  });
});

describe('generateStoragePath', () => {
  it('includes the originals prefix, year, month, uuid and filename', () => {
    const path = generateStoragePath('photo.jpg');
    expect(path.startsWith('originals/')).toBe(true);
    expect(path.endsWith('/photo.jpg')).toBe(true);
    const segments = path.split('/');
    expect(segments.length).toBe(5);
    expect(segments[1]).toMatch(/^\d{4}$/);
    expect(segments[2]).toMatch(/^\d{2}$/);
  });

  it('sanitizes the filename in the path', () => {
    const path = generateStoragePath('bad<name>.jpg');
    expect(path).toContain('bad_name_.jpg');
  });
});

describe('media constants', () => {
  it('only allows image MIME types', () => {
    expect(ALLOWED_MEDIA_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
    ]);
  });

  it('sets a 10 MB limit', () => {
    expect(MAX_MEDIA_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
