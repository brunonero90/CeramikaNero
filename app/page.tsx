import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CloneCta } from '@/components/clone/marketing';
import { homepageServices } from '@/lib/clone/content/landings';

export const metadata: Metadata = {
  title: 'Ceramika Nero | warsztaty z ceramiki Poznań',
  description:
    'Wybierz warsztat i zarezerwuj dogodny termin w Pracowni Ceramiki Nero — Suchy Las / Poznań.',
};

export default function HomePage() {
  return (
    <div className="bg-surface-bg">
      <section className="mx-auto max-w-5xl px-4 pt-12 pb-6 text-center md:px-6 md:pt-16">
        <h1 className="font-heading text-4xl font-semibold text-text-primary md:text-5xl">
          Wybierz warsztat
        </h1>
        <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-text-muted uppercase">
          ZAREZERWUJ DOGODNY TERMIN
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <span className="bg-text-primary px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase">
            Wszystkie usługi
          </span>
          <span className="border border-surface-subtle px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
            CERAMIKA NERO PODGÓRNA 3 SUCHY LAS
          </span>
          <span className="border border-surface-subtle px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase">
            Inne lokalizacje
          </span>
        </div>
      </section>

      <section
        aria-label="Lista warsztatów"
        className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 sm:grid-cols-2 md:px-6 lg:grid-cols-3"
      >
        {homepageServices.map((service) => (
          <article
            key={service.title}
            className="flex flex-col border border-surface-subtle/50 bg-surface-raised"
          >
            <div className="relative aspect-[3/2] overflow-hidden">
              <Image
                src={service.image}
                alt={service.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 303px"
              />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h2 className="font-heading text-base font-semibold tracking-wide text-text-primary uppercase">
                {service.title}
              </h2>
              <p className="mt-2">
                <Link
                  href={service.href}
                  className="text-sm text-accent-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  Więcej
                </Link>
              </p>
              <div className="mt-4 flex items-end justify-between gap-3 text-sm text-text-muted">
                <span>{service.day}</span>
                <span className="font-semibold text-text-primary">
                  {service.price}
                </span>
              </div>
              <div className="mt-5">
                {'soldOut' in service && service.soldOut ? (
                  <p className="text-sm font-semibold text-text-muted">
                    Brak wolnych miejsc
                  </p>
                ) : null}
                <CloneCta href={service.href} className="mt-2 w-full">
                  {service.cta}
                </CloneCta>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-10 text-center md:px-6">
        <h2 className="font-heading text-2xl font-semibold text-text-primary">
          Grafik zajęć
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
          Interaktywny kalendarz Wix Bookings został zastąpiony listą warsztatów
          powyżej. Wybierz ofertę i przejdź do rezerwacji w naszym systemie —
          bez osadzania runtime Wix.
        </p>
        <div className="mt-6">
          <CloneCta href="/kontakt">Zapytaj o termin</CloneCta>
        </div>
      </section>
    </div>
  );
}
