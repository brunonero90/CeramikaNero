import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CloneCta } from '@/components/clone/marketing';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { homepageServices } from '@/lib/clone/content/landings';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToHomepageServices } from '@/lib/cms/document-adapters';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';

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
      soldOut: 'soldOut' in service ? service.soldOut : undefined,
    }));

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
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {header.chips.map((chip, index) => (
            <span
              key={chip}
              className={
                index === 0
                  ? 'bg-text-primary px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase'
                  : 'border border-surface-subtle px-4 py-2 text-xs font-semibold tracking-wide text-text-muted uppercase'
              }
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      <section
        aria-label="Lista warsztatów"
        className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 sm:grid-cols-2 md:px-6 lg:grid-cols-3"
      >
        {services.map((service) => (
          <article
            key={service.id}
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
                  href={service.moreHref}
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
                {service.soldOut ? (
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

      {/* Structural calendar CTA chrome — not CMS-managed marketing copy. */}
      <section className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-10 text-center md:px-6">
        <h2 className="font-heading text-2xl font-semibold text-text-primary">
          Grafik zajęć
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-text-muted">
          Interaktywny kalendarz Wix Bookings został zastąpiony naszym
          kalendarzem terminów. Wybierz ofertę poniżej lub otwórz pełny
          kalendarz.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <CloneCta href="/kalendarz">Kalendarz warsztatów</CloneCta>
          <CloneCta href="/kontakt" variant="outline">
            Zapytaj o termin
          </CloneCta>
        </div>
      </section>
    </div>
  );
}
