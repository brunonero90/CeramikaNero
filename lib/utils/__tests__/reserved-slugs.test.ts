import { describe, expect, it } from 'vitest';
import { isReservedPageSlug, RESERVED_PAGE_SLUGS } from '../reserved-slugs';

describe('reserved page slugs', () => {
  it('contains key application routes', () => {
    expect(RESERVED_PAGE_SLUGS.has('admin')).toBe(true);
    expect(RESERVED_PAGE_SLUGS.has('warsztaty')).toBe(true);
    expect(RESERVED_PAGE_SLUGS.has('blog')).toBe(true);
  });

  it('reports reserved slugs case-insensitively', () => {
    expect(isReservedPageSlug('ADMIN')).toBe(true);
    expect(isReservedPageSlug('Blog')).toBe(true);
  });

  it('allows non-reserved slugs', () => {
    expect(isReservedPageSlug('o-nas')).toBe(false);
    expect(isReservedPageSlug('moja-wlasna-strona')).toBe(false);
  });

  it('reserves clone shop and legal routes', () => {
    expect(isReservedPageSlug('regulamin')).toBe(true);
    expect(isReservedPageSlug('sklep')).toBe(true);
    expect(isReservedPageSlug('cart')).toBe(true);
  });
});
