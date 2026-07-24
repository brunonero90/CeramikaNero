import Image from 'next/image';
import Link from 'next/link';
import { CloneCta } from '@/components/clone/marketing';

export type ArchiveSection = {
  heading: string | null;
  text: string;
  images: readonly { alt: string; src: string; dims?: string }[];
  buttons: readonly { label: string; href: string }[];
};

export type ArchivePageData = {
  title: string;
  route: string;
  sections: readonly ArchiveSection[];
  images?: readonly { src: string; alt: string; sectionNumber?: number }[];
};

function localizeHref(href: string) {
  if (!href || href === '#') return '#';
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return href;
  if (href.startsWith('http') && !href.includes('ceramikanero.com'))
    return href;
  return href.replace(/^https?:\/\/(www\.)?ceramikanero\.com/i, '') || '/';
}

/** Shared renderer for archived Phase 2 pages. */
export function ArchivePageView({
  page,
  bookingAdaptation,
}: {
  page: ArchivePageData;
  bookingAdaptation?: { href: string; label: string };
}) {
  const heading =
    page.title.replace(/\s*\|\s*Pracownia Ceramiki N.*$/i, '').trim() ||
    page.sections.find((s) => s.heading)?.heading ||
    page.title ||
    'Ceramika Nero';

  return (
    <div className="bg-surface-bg">
      <header className="mx-auto max-w-3xl px-4 pt-12 pb-6 text-center md:px-6 md:pt-16">
        <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
          {heading}
        </h1>
      </header>

      {page.sections.map((section, index) => (
        <section
          key={`${section.heading ?? 'section'}-${index}`}
          className="border-t border-surface-subtle/30"
        >
          <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
            {section.heading ? (
              <h2 className="font-heading text-2xl font-semibold text-text-primary">
                {section.heading}
              </h2>
            ) : null}
            {section.text ? (
              <div className="mt-4 space-y-4 text-base leading-relaxed whitespace-pre-line text-text-muted">
                {section.text}
              </div>
            ) : null}
            {section.images.length > 0 ? (
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {section.images.map((img) => (
                  <figure
                    key={img.src + img.alt}
                    className="relative aspect-[4/3]"
                  >
                    <Image
                      src={img.src}
                      alt={img.alt || ''}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </figure>
                ))}
              </div>
            ) : null}
            {section.buttons.length > 0 ? (
              <div className="mt-8 flex flex-wrap gap-3">
                {section.buttons
                  .filter((b) => !/^Udostępnij|Sortuj|Podgląd$/i.test(b.label))
                  .slice(0, 8)
                  .map((b) => (
                    <CloneCta
                      key={`${b.label}-${b.href}`}
                      href={localizeHref(b.href)}
                    >
                      {b.label.split('\n')[0]!.slice(0, 60)}
                    </CloneCta>
                  ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {bookingAdaptation ? (
        <section className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-10 text-center md:px-6">
          <p className="mx-auto max-w-2xl text-sm text-text-muted">
            Kalendarz Wix Bookings został zastąpiony pierwszorzędną rezerwacją
            na tej stronie (bez wywołań zewnętrznych w tej fazie).
          </p>
          <div className="mt-6">
            <CloneCta href={bookingAdaptation.href}>
              {bookingAdaptation.label}
            </CloneCta>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function BlogCategoryNav({ active }: { active?: string }) {
  const items = [
    { href: '/blog', label: 'Wszystkie' },
    { href: '/blog/categories/aktualności', label: 'Aktualności' },
    { href: '/blog/categories/o-mnie', label: 'O mnie' },
    { href: '/blog/categories/ciekawostki', label: 'Ciekawostki' },
  ];
  return (
    <nav
      aria-label="Kategorie bloga"
      className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3 px-4 pb-8"
    >
      {items.map((item) => {
        const isActive =
          active === item.label ||
          (item.href === '/blog' && !active) ||
          (active && item.href.endsWith(active));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-semibold tracking-wide uppercase ${
              isActive
                ? 'text-accent-primary underline underline-offset-4'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
