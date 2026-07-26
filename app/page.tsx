import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HomepageServicesSection } from '@/components/clone/homepage-services-section';
import { PublicEventCalendar } from '@/components/calendar/public-event-calendar';
import {
  EmptyState,
  PageShell,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionHeading,
} from '@/components/public/ui';
import { homepageServices } from '@/lib/clone/content/landings';
import { inferHomepageVenueKey } from '@/lib/clone/venue';
import { getPublicCalendarSessions } from '@/lib/database/services/calendar';
import {
  getGalleryImages,
  getHomeHeroImage,
  getPracowniaImages,
} from '@/lib/media/wix-catalog';
import { siteContact } from '@/lib/fixtures/navigation';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ceramika Nero | warsztaty ceramiczne Suchy Las / Poznań',
  description:
    'Warsztaty z gliny dla dzieci i dorosłych, Glina Box oraz wydarzenia prywatne w Pracowni Ceramiki Nero — Suchy Las i Ptasie Radio w Poznaniu.',
};

const CHOICES = [
  {
    title: 'Warsztaty dla dzieci',
    description: 'Kursy i zajęcia kreatywne w kameralnych grupach.',
    href: '/dla-dzieci',
    image: '/images/wix-migrated/747d6f_af946e4dbc8d40208b3d1c05be4cebbe.jpg',
  },
  {
    title: 'Warsztaty dla dorosłych',
    description: 'Slow ceramika, Glina do wina i wieczorne spotkania.',
    href: '/dla-doroslych',
    image: '/images/wix-migrated/747d6f_85e6210e2fd54cd6885c6833e198c58d.jpg',
  },
  {
    title: 'Grupy i wydarzenia',
    description: 'Urodziny, panieńskie i integracje firmowe na zamówienie.',
    href: '/grupy-i-firmy',
    image: '/images/wix-migrated/747d6f_27032db4ff7642f185f09f10408c5e0f.jpg',
  },
  {
    title: 'Glina Box',
    description: 'Zestaw do lepienia w domu — 229 zł, opcjonalne szkliwienie 69 zł.',
    href: '/home',
    image: '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg',
  },
] as const;

export default async function HomePage() {
  const hero =
    getHomeHeroImage() ??
    ({
      src: '/images/wix-migrated/747d6f_85e6210e2fd54cd6885c6833e198c58d.jpg',
      alt: 'Pracownia ceramiki Nero',
      width: 1600,
      height: 1067,
    } as const);

  const calendarSessions = (
    await getPublicCalendarSessions().catch(() => [])
  ).map((s) => ({
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
    venueKey: s.venueKey,
  }));

  const services = homepageServices.map((service, index) => ({
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
    venueKey:
      service.venueKey ??
      inferHomepageVenueKey({
        href: service.href,
        moreHref: service.moreHref,
      }),
  }));

  const studioImages = getPracowniaImages().slice(0, 3);
  const gallery = getGalleryImages().slice(0, 6);

  return (
    <PageShell>
      <section className="relative min-h-[72vh] w-full overflow-hidden md:min-h-[78vh]">
        <Image
          src={hero.src}
          alt={hero.alt || 'Pracownia ceramiki Nero'}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a1812]/80 via-[#2a1812]/35 to-[#2a1812]/20" />
        <div className="relative mx-auto flex min-h-[72vh] max-w-5xl flex-col justify-end px-4 pb-12 text-white md:min-h-[78vh] md:px-6 md:pb-16">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase opacity-90">
            Pracownia ceramiki · Suchy Las / Poznań
          </p>
          <h1 className="mt-3 max-w-2xl font-heading text-4xl font-semibold leading-tight md:text-6xl">
            Ceramika Nero
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">
            Warsztaty z gliny, kameralne kursy i Glina Box — tworzenie własnymi
            rękami w ciepłej, spokojnej atmosferze.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton href="/kalendarz">Zobacz terminy</PrimaryButton>
            <SecondaryButton
              href="/warsztaty"
              className="border-white text-white hover:bg-white/10"
            >
              Przeglądaj warsztaty
            </SecondaryButton>
          </div>
        </div>
      </section>

      <Section>
        <SectionHeading
          eyebrow="Wybierz ścieżkę"
          title="Dla kogo jest Ceramika Nero?"
          description="Cztery jasne kierunki — bez zgadywania, którą stronę otworzyć."
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CHOICES.map((choice) => (
            <Link
              key={choice.href}
              href={choice.href}
              className="group overflow-hidden border border-surface-subtle/50 bg-surface-raised transition-base hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <div className="relative aspect-[16/10]">
                <Image
                  src={choice.image}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width:640px) 100vw, 50vw"
                />
              </div>
              <div className="p-5">
                <h3 className="font-heading text-xl font-semibold">
                  {choice.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {choice.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="warm" id="terminy">
        <SectionHeading
          eyebrow="Kalendarz"
          title="Nadchodzące terminy"
          description="Rzeczywiste, opublikowane sesje z bazy. Rezerwacja prowadzi do dokładnego terminu."
          align="center"
        />
        {calendarSessions.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Brak opublikowanych terminów"
              description="Napisz do nas lub przejrzyj katalog warsztatów — część ofert jest dostępna jako zapytanie."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <PrimaryButton href="/warsztaty">Warsztaty</PrimaryButton>
                  <SecondaryButton href="/kontakt">Kontakt</SecondaryButton>
                </div>
              }
            />
          </div>
        ) : (
          <div className="mt-6">
            <PublicEventCalendar sessions={calendarSessions} compact />
            <div className="mt-6 text-center">
              <SecondaryButton href="/kalendarz">
                Pełny kalendarz
              </SecondaryButton>
            </div>
          </div>
        )}
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Oferta"
          title="Wybierz warsztat"
          description="Filtruj według lokalizacji. „Inne lokalizacje” to obecnie Ptasie Radio w Poznaniu."
          align="center"
        />
        <Suspense fallback={<div className="mt-8 h-40" aria-hidden />}>
          <HomepageServicesSection
            chips={[
              'Wszystkie usługi',
              'CERAMIKA NERO PODGÓRNA 3 SUCHY LAS',
              'Inne lokalizacje',
            ]}
            services={services}
          />
        </Suspense>
      </Section>

      <Section tone="raised">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Pracownia"
              title="Miejsce, w którym glina staje się spokojem"
              description="Tworzymy i uczymy w Suchym Lesie przy ul. Podgórnej 3. Część spotkań prowadzimy też w Ptasim Radiu w Poznaniu."
            />
            <div className="mt-6">
              <SecondaryButton href="/pracownia">Poznaj pracownię</SecondaryButton>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(studioImages.length
              ? studioImages
              : [{ src: hero.src, alt: hero.alt }]
            ).map((img, i) => (
              <div
                key={img.src + i}
                className={`relative overflow-hidden ${i === 0 ? 'col-span-2 aspect-[16/10]' : 'aspect-square'}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt || 'Pracownia Ceramika Nero'}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 40vw"
                />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {gallery.length > 0 ? (
        <Section>
          <SectionHeading
            title="Z pracowni"
            description="Wybrane prace i atmosferę zajęć — więcej w galerii."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden">
                <Image
                  src={img.src}
                  alt={img.alt || 'Praca ceramiczna'}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <SecondaryButton href="/galeria">Otwórz galerię</SecondaryButton>
          </div>
        </Section>
      ) : null}

      <Section tone="warm">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeading
              eyebrow="Produkt"
              title="Glina Box — 229 zł"
              description="Zestaw do lepienia w domu z instrukcją i filmem. Opcjonalne profesjonalne szkliwienie i wypał w pracowni: 69 zł (osobno)."
            />
            <p className="mt-3 text-sm text-text-muted">
              Odbiór w pracowni lub wysyłka do domu — koszt wysyłki potwierdzimy
              przed płatnością.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryButton href="/home">Zamów Glina Box</PrimaryButton>
              <SecondaryButton href="/cart">Koszyk</SecondaryButton>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src="/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg"
              alt="Glina Box"
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 40vw"
            />
            <p className="absolute bottom-3 left-3 bg-white/95 px-3 py-1 text-sm font-semibold text-text-primary">
              {formatPrice(22900)}
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Na zamówienie"
          title="Urodziny, firmy, panieńskie"
          description="Oferty prywatne wyceniamy indywidualnie — bez fałszywych terminów w koszyku."
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryButton href="/kontakt?oferta=wydarzenie-prywatne">
            Poproś o ofertę
          </PrimaryButton>
          <SecondaryButton href="/urodziny">Urodziny</SecondaryButton>
          <SecondaryButton href="/panienskie">Panieńskie</SecondaryButton>
        </div>
      </Section>

      <Section tone="raised">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SectionHeading title="Tu nas znajdziesz" />
            <address className="mt-4 not-italic leading-relaxed text-text-muted">
              {siteContact.brand}
              <br />
              {siteContact.addressLine}
              <br />
              {siteContact.cityLine}
              <br />
              <a
                href={siteContact.phoneHref}
                className="mt-3 inline-block text-text-primary underline-offset-2 hover:underline"
              >
                {siteContact.phoneDisplay}
              </a>
              <br />
              <a
                href={`mailto:${siteContact.email}`}
                className="underline-offset-2 hover:underline"
              >
                {siteContact.email}
              </a>
            </address>
          </div>
          <div className="flex flex-col justify-end gap-3 md:items-end">
            <PrimaryButton href="/kalendarz">Zarezerwuj termin</PrimaryButton>
            <SecondaryButton href="/kontakt">Napisz do nas</SecondaryButton>
          </div>
        </div>
      </Section>
    </PageShell>
  );
}
