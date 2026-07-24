import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import type { ArchivePageData } from '@/components/clone/archive-page';

export function getArchivePage(route: string): ArchivePageData | null {
  const page = (archivePages as unknown as Record<string, ArchivePageData>)[
    route
  ];
  if (!page) return null;
  // Detach from `as const` fixtures for safe RSC/SSG serialization.
  const cloned = JSON.parse(JSON.stringify(page)) as ArchivePageData;
  // Strip zero-width / bidi marks that can break HTML attribute serialization.
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

export function listArchiveRoutes(): string[] {
  return Object.keys(archivePages);
}

/** Map booking/service presentation to first-party booking entry. */
export function bookingAdaptationFor(route: string): {
  href: string;
  label: string;
} | null {
  if (
    route.startsWith('/booking-calendar/') ||
    route.startsWith('/service-page/') ||
    route.startsWith('/courses/')
  ) {
    return {
      href: '/',
      label: 'Zobacz warsztaty i zarezerwuj (katalog)',
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
