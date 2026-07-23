import { describe, expect, it } from 'vitest';
import {
  normaliseSlugInput,
  slugifyTitle,
  isValidSlug,
  isReservedSlug,
  ensureUniqueSlug,
} from '../slugs';

describe('normaliseSlugInput', () => {
  it('normalises Polish characters', () => {
    expect(normaliseSlugInput('Warsztaty ceramiczne Łódź')).toBe(
      'warsztaty-ceramiczne-lodz'
    );
  });

  it('lowercases and replaces spaces with hyphens', () => {
    expect(normaliseSlugInput('Hello World')).toBe('hello-world');
  });

  it('removes unsafe characters', () => {
    expect(normaliseSlugInput('a@b#c')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(normaliseSlugInput('-hello-world-')).toBe('hello-world');
  });
});

describe('slugifyTitle', () => {
  it('produces a slug from a title', () => {
    expect(slugifyTitle('Pierwsze kroki w ceramice')).toBe(
      'pierwsze-kroki-w-ceramice'
    );
  });
});

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('hello-world')).toBe(true);
    expect(isValidSlug('a1')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('Hello World')).toBe(false);
    expect(isValidSlug('hello--world')).toBe(false);
    expect(isValidSlug('hello.world')).toBe(false);
  });
});

describe('isReservedSlug', () => {
  it('detects reserved application routes', () => {
    expect(isReservedSlug('admin')).toBe(true);
    expect(isReservedSlug('warsztaty')).toBe(true);
  });
});

describe('ensureUniqueSlug', () => {
  it('keeps the slug when it is unique', async () => {
    const slug = await ensureUniqueSlug(async () => false, 'hello');
    expect(slug).toBe('hello');
  });

  it('appends a counter when the slug is taken', async () => {
    let calls = 0;
    const slug = await ensureUniqueSlug(async () => {
      calls += 1;
      return calls < 3;
    }, 'hello');
    expect(slug).toBe('hello-2');
  });
});
