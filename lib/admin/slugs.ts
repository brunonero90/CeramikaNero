import { isReservedPageSlug } from '@/lib/utils/reserved-slugs';

const POLISH_TO_LATIN: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  Á: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
};

export function normaliseSlugInput(input: string): string {
  return input
    .split('')
    .map((char) => POLISH_TO_LATIN[char] ?? char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

export function slugifyTitle(title: string): string {
  return normaliseSlugInput(title);
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isReservedSlug(slug: string): boolean {
  return isReservedPageSlug(slug);
}

export async function ensureUniqueSlug(
  check: (slug: string) => Promise<boolean>,
  slug: string
): Promise<string> {
  let candidate = slug;
  let counter = 1;
  while (await check(candidate)) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export function workshopPath(slug: string): string {
  return `/warsztaty/${slug}`;
}

export function pagePath(slug: string): string {
  return `/${slug}`;
}

export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}
