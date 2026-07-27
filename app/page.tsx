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
import { getGalleryImages } from '@/lib/media/wix-catalog';
import { siteContact } from '@/lib/fixtures/navigation';
import { formatPrice } from '@/lib/utils/price';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ceramika Nero | warsztaty ceramiczne Suchy Las / Poznań',
  description:
    'Warsztaty z gliny dla dzieci i dorosłych, Glina Box oraz wydarzenia prywatne w Pracowni Ceramiki Nero — Suchy Las i Ptasie Radio w Poznaniu.',
};

const ATELIER_HERO = {
  src: '/images/generated/atelier-hero.png',
  alt: 'Ceramiczka formuje gliniany wazon w jasnej, spokojnej pracowni',
  width: 1536,
  height: 1024,
} as const;

const STUDIO_PORTRAIT = {
  src: '/images/wix-migrated/747d6f_11d47ff20fcf4afa9085b728719b20f0.jpg',
  alt: 'Małgorzata Nero w pracowni Ceramika Nero',
} as const;

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
    description:
      'Zestaw do lepienia w domu — 229 zł, opcjonalne szkliwienie 69 zł.',
    href: '/home',
    image: '/images/wix-migrated/747d6f_77fc63c840ea462ab19c35b60bc959cf.jpg',
  },
] as const;

export default async function HomePage() {
  const hero = ATELIER_HERO;

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

  const gallery = getGalleryImages().slice(0, 6);

  return (
    <PageShell className="atelier-paper">
      <section
        aria-label="Baner główny"
        className="relative isolate overflow-hidden border-b border-[#ddcbbb]/70"
      >
        <div
          className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full border border-[#c86b48]/15"
          aria-hidden
        />
        <div className="mx-auto grid w-full max-w-[1440px] lg:min-h-[620px] lg:grid-cols-[minmax(420px,0.86fr)_minmax(0,1.14fr)]">
          <div className="relative z-10 flex items-center px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20 xl:px-16">
            <div className="max-w-[590px]">
              <p className="mb-5 flex items-center gap-3 text-[11px] font-semibold tracking-[0.22em] text-[#a34f35] uppercase sm:text-xs">
                <span className="h-px w-10 bg-[#c86b48]" aria-hidden />
                Pracownia ceramiczna w Suchym Lesie
              </p>
              <h1 className="font-heading text-[clamp(3.35rem,6.2vw,6.75rem)] font-medium leading-[0.88] tracking-[-0.035em] text-[#30231e]">
                Tu glina
                <br />
                zmienia się w coś
                <br />
                osobistego
              </h1>
              <div className="mt-7 h-px w-16 bg-[#c86b48]" aria-hidden />
              <p className="mt-6 max-w-lg text-base leading-8 text-[#56463f] sm:text-lg">
                Warsztaty ceramiczne dla dzieci, dorosłych i grup w Suchym
                Lesie. Twórz własnymi rękami, odpocznij i zabierz ze sobą coś
                naprawdę Twojego.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryButton
                  href="/kalendarz"
                  className="rounded-md bg-[#b95e3f] px-7 normal-case"
                >
                  Zarezerwuj warsztat
                </PrimaryButton>
                <SecondaryButton
                  href="/pracownia"
                  className="rounded-md border-[#746758] px-7 text-[#3f352f] normal-case hover:bg-white/50"
                >
                  Poznaj pracownię
                </SecondaryButton>
              </div>
            </div>
          </div>

          <div className="relative min-h-[400px] overflow-hidden sm:min-h-[510px] lg:min-h-[620px] lg:rounded-l-[3.5rem]">
            <Image
              src={hero.src}
              alt={hero.alt}
              fill
              priority
              loading="eager"
              className="object-cover object-[54%_center]"
              sizes="(min-width: 1024px) 60vw, 100vw"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#241711]/45 to-transparent"
              aria-hidden
            />
            <div className="absolute right-5 bottom-5 flex items-start gap-3 rounded-md border border-white/20 bg-[#2b1c16]/45 px-4 py-3 text-sm leading-5 text-white backdrop-blur-[2px] sm:right-8 sm:bottom-7">
              <LocationIcon />
              <p>
                Pracownia Ceramika Nero
                <br />
                ul. Podgórna 3, Suchy Las
              </p>
            </div>
          </div>
        </div>
      </section>

      <Section className="py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem]">
            <Image
              src={STUDIO_PORTRAIT.src}
              alt={STUDIO_PORTRAIT.alt}
              fill
              className="object-cover object-center"
              sizes="(max-width:768px) 100vw, 48vw"
            />
          </div>
          <div>
            <SectionHeading
              eyebrow="Nasza pracownia"
              title="Miejsce, w którym ręce odpoczywają"
              description="Tworzymy i uczymy w Suchym Lesie przy ul. Podgórnej 3. To spokojna przestrzeń na własne pomysły, uważność i przyjemność tworzenia."
            />
            <p className="mt-5 max-w-xl text-base leading-8 text-text-muted">
              Nie musisz nic umieć. Pokażemy Ci glinę krok po kroku, zapewnimy
              wszystkie materiały i zajmiemy się wypałem gotowej pracy.
            </p>
            <div className="mt-7">
              <SecondaryButton
                href="/pracownia"
                className="rounded-md normal-case"
              >
                Poznaj pracownię
              </SecondaryButton>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="raised" className="border-y border-[#ddcbbb]/60">
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
              className="group overflow-hidden rounded-[1.5rem] border border-surface-subtle/50 bg-surface-raised transition-base hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
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
                Zobacz terminy
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

      {gallery.length > 0 ? (
        <Section>
          <SectionHeading
            title="Z pracowni"
            description="Wybrane prace i atmosferę zajęć — więcej w galerii."
          />
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square overflow-hidden"
              >
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

function LocationIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
      className="mt-0.5 shrink-0"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
