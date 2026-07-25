import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HomepageServicesSection } from '@/components/clone/homepage-services-section';
import { PublicEventCalendar } from '@/components/calendar/public-event-calendar';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { homepageServices } from '@/lib/clone/content/landings';
import {
  getHomepageCalendarFixtures,
  HOMEPAGE_CALENDAR_FIXTURE_BANNER,
  shouldUseHomepageCalendarFixtures,
} from '@/lib/clone/content/homepage-calendar-fixtures';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToHomepageServices } from '@/lib/cms/document-adapters';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';
import { getPublicCalendarSessions } from '@/lib/database/services/calendar';
import {
  isBookingLocalMode,
  LOCAL_BOOKING_BANNER,
} from '@/lib/booking/local-mode';
import { inferHomepageVenueKey } from '@/lib/clone/venue';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/'), {
    allowDraftPreview: true,
  });
  return {
    title:
      resolved?.document.title ?? 'Ceramika Nero | warsztaty z ceramiki Poznań',
    description:
      resolved?.document.metaDescription ??
      'Wybierz warsztat i zarezerwuj dogodny termin w Pracowni Ceramiki Nero — Suchy Las / Poznań.',
  };
}

export default async function HomePage() {
  const resolved = await resolveClonePage(cmsSlugFromRoute('/'), {
    allowDraftPreview: true,
  });
  const parts = resolved ? documentToHomepageServices(resolved.document) : null;
  const header = parts?.header ?? {
    title: 'Wybierz warsztat',
    subtitle: 'ZAREZERWUJ DOGODNY TERMIN',
    chips: [
      'Wszystkie usługi',
      'CERAMIKA NERO PODGÓRNA 3 SUCHY LAS',
      'Inne lokalizacje',
    ],
  };
  const services =
    parts?.services ??
    homepageServices.map((service, index) => ({
      id: `svc-${index}`,
      title: service.title,
      day: service.day,
      price: service.price,
      image: service.image,
      imageAlt: service.imageAlt,
      moreHref: service.moreHref,
      href: service.href,
      cta: service.cta,
      soldOut: service.soldOut,
      venueKey: service.venueKey,
    }));

  const servicesWithVenue = services.map((service) => ({
    ...service,
    venueKey:
      service.venueKey ??
      inferHomepageVenueKey({
        href: service.href,
        moreHref: service.moreHref,
      }),
  }));

  const useFidelityFixtures = shouldUseHomepageCalendarFixtures();
  const useLocalBooking = isBookingLocalMode();
  const calendarSessions = useFidelityFixtures
    ? getHomepageCalendarFixtures()
    : (await getPublicCalendarSessions().catch(() => [])).map((s) => ({
        id: s.id,
        workshopTitle: s.workshopTitle,
        workshopSlug: s.workshopSlug,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        timezone: s.timezone,
        capacity: s.capacity,
        reservedCount: s.reservedCount,
        priceGrossGrosz: s.priceGrossGrosz,
        status: s.status,
        locationName: s.locationName,
      }));
  const showCalendar = calendarSessions.length > 0;
  const calendarBanner = useFidelityFixtures
    ? HOMEPAGE_CALENDAR_FIXTURE_BANNER
    : useLocalBooking
      ? LOCAL_BOOKING_BANNER
      : null;

  return (
    <div className="bg-surface-bg">
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-6 text-center md:px-6 md:pt-16">
        <h1 className="font-heading text-4xl font-semibold text-text-primary md:text-5xl">
          {header.title}
        </h1>
        <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-text-muted uppercase">
          {header.subtitle}
        </p>
        <Suspense fallback={<div className="mt-8 h-10" aria-hidden="true" />}>
          <HomepageServicesSection
            chips={header.chips}
            services={servicesWithVenue}
          />
        </Suspense>
      </section>

      <section
        aria-label="Grafik zajęć"
        className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-8 md:px-6 md:py-10"
      >
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-heading text-2xl font-semibold text-text-primary">
            Grafik zajęć
          </h2>
          {calendarBanner ? (
            <p className="mx-auto mt-2 max-w-2xl text-[11px] font-semibold tracking-wide text-accent-primary uppercase">
              {calendarBanner}
            </p>
          ) : null}
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
            Filtruj według: Usługa (Wszystkie) · Pracownik (Wszystkie)
          </p>
        </div>
        {showCalendar ? (
          <PublicEventCalendar sessions={calendarSessions} compact />
        ) : (
          <p className="mx-auto mt-6 max-w-xl text-center text-sm text-text-muted">
            Terminy pojawią się w kalendarzu po publikacji sesji. Zobacz ofertę
            warsztatów powyżej lub{' '}
            <Link href="/kontakt" className="underline underline-offset-2">
              napisz do nas
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
