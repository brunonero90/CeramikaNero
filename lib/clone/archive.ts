import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import type { ArchivePageData } from '@/components/clone/archive-page';

function scrubPage(page: ArchivePageData): ArchivePageData {
  const cloned = JSON.parse(JSON.stringify(page)) as ArchivePageData;
  const scrub = (s: string) =>
    s.replace(/[\u200b\u200c\u200d\ufeff\u2028\u2029]/g, '');
  return {
    ...cloned,
    title: scrub(cloned.title),
    sections: cloned.sections.map((section) => ({
      ...section,
      heading: section.heading ? scrub(section.heading) : section.heading,
      text: scrub(section.text),
      buttons: section.buttons.map((b) => ({
        label: scrub(b.label),
        href: scrub(b.href),
      })),
      images: section.images.map((img) => ({
        ...img,
        alt: scrub(img.alt || ''),
        src: scrub(img.src),
      })),
    })),
  };
}

/** Candidate keys for archive lookup (encoded/decoded/NFC). */
export function archiveRouteCandidates(route: string): string[] {
  const out: string[] = [];
  const add = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };
  add(route);
  try {
    add(decodeURIComponent(route));
  } catch {
    // ignore malformed sequences
  }
  for (const value of [...out]) {
    add(value.normalize('NFC'));
    add(value.normalize('NFD'));
  }
  return out;
}

export function getArchivePage(route: string): ArchivePageData | null {
  const table = archivePages as unknown as Record<string, ArchivePageData>;
  for (const key of archiveRouteCandidates(route)) {
    const page = table[key];
    if (page) {
      // Detach from `as const` fixtures for safe RSC/SSG serialization.
      return scrubPage(page);
    }
  }
  return null;
}

export function listArchiveRoutes(): string[] {
  return Object.keys(archivePages);
}

/** Map booking/service presentation to first-party booking entry. */
export function bookingAdaptationFor(route: string): {
  href: string;
  label: string;
} | null {
  const slug = decodeURIComponent(route.split('/').pop() ?? '').toLowerCase();

  if (
    slug.includes('glina-do-wina') ||
    slug.includes('glina do wina') ||
    slug.includes('ptasim')
  ) {
    return {
      href: '/warsztaty/glina-do-wina/rezerwacja',
      label: 'Zarezerwuj Glina do wina',
    };
  }
  if (
    slug.includes('ceramika-dla-doros') ||
    slug.includes('poranki-z-ceramik')
  ) {
    return {
      href: '/warsztaty/ceramika-dla-doroslych/rezerwacja',
      label: 'Zarezerwuj ceramikę dla dorosłych',
    };
  }
  if (slug.includes('glina-i-rodzina')) {
    return {
      href: '/warsztaty/glina-i-rodzina/rezerwacja',
      label: 'Zarezerwuj Glina i rodzina',
    };
  }
  if (
    slug.includes('letnia-akademia') ||
    slug.includes('rysunku-malarstwa')
  ) {
    return {
      href: '/warsztaty/kurs-rysunku-malarstwa-ceramiki-6-10-lat/rezerwacja',
      label: 'Zarezerwuj warsztat dla dzieci',
    };
  }
  if (
    slug.includes('paniensk') ||
    slug.includes('urodzin') ||
    slug.includes('półkolonie') ||
    slug.includes('polkolonie') ||
    slug.includes('piknik')
  ) {
    return {
      href: '/kontakt',
      label: 'Napisz w sprawie terminu',
    };
  }

  if (
    route.startsWith('/booking-calendar/') ||
    route.startsWith('/service-page/') ||
    route.startsWith('/courses/')
  ) {
    return {
      href: '/kalendarz',
      label: 'Zobacz kalendarz i zarezerwuj',
    };
  }
  if (route.startsWith('/webinar-registration')) {
    return {
      href: '/kontakt',
      label: 'Napisz w sprawie terminu',
    };
  }
  return null;
}

/**
 * ASCII filesystem-safe aliases for original Wix routes that contain ń.
 * Canonical archive keys remain unicode; public app folders use ASCII.
 */
export const UNICODE_ROUTE_ALIASES = {
  '/copy-of-panienski-opis': '/copy-of-panieński-opis',
  '/kopia-panienski-plus-opis': '/kopia-panieński-plus-opis',
} as const;
