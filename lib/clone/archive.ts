import { archivePages } from '@/lib/clone/content/phase2/archive-pages';
import type { ArchivePageData } from '@/components/clone/archive-page';

export function getArchivePage(route: string): ArchivePageData | null {
  const page = (archivePages as unknown as Record<string, ArchivePageData>)[
    route
  ];
  return page ?? null;
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
