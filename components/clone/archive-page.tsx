import Image from 'next/image';
import Link from 'next/link';
import { ArchiveRichText } from '@/components/clone/archive-rich-text';
import { CloneCta } from '@/components/clone/marketing';
import { resolveCtaHref } from '@/lib/clone/link-resolve';
import { knownHeadingsForSection } from '@/lib/clone/page-spec-headings';

export type ArchiveSection = {
  heading: string | null;
  text: string;
  images: readonly { alt: string; src: string; dims?: string }[];
  buttons: readonly { label: string; href: string }[];
  /** Evidence-backed headings from page-spec (optional override). */
  knownHeadings?: readonly string[];
};

export type ArchivePageData = {
  title: string;
  route: string;
  sections: readonly ArchiveSection[];
  images?: readonly { src: string; alt: string; sectionNumber?: number }[];
};

function normalizeKey(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Site footer chrome captured into archive fixtures — rendered by SiteFooter. */
function isFooterSection(section: ArchiveSection): boolean {
  const heading = section.heading || '';
  const text = section.text || '';
  if (/^pracownia ceramiki nero$/i.test(heading.trim())) return true;
  if (/zapisz się do newslettera/i.test(text) && /NIP\s*\d/i.test(text)) {
    return true;
  }
  return false;
}

/** Drop leading heading duplicate when section.text starts with section.heading. */
function bodyTextWithoutHeading(heading: string | null, text: string): string {
  if (!heading || !text) return text;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headingLines = heading.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (
    i < headingLines.length &&
    i < lines.length &&
    normalizeKey(lines[i] || '') === normalizeKey(headingLines[i] || '')
  ) {
    i += 1;
  }
  if (i === 0) return text;
  while (i < lines.length && !lines[i]!.trim()) i += 1;
  return lines.slice(i).join('\n').trim();
}

/** Shared renderer for archived Phase 2 pages. */
export function ArchivePageView({
  page,
  bookingAdaptation,
}: {
  page: ArchivePageData;
  bookingAdaptation?: { href: string; label: string };
}) {
  const contentSections = page.sections.filter((s) => !isFooterSection(s));
  const heading =
    page.title.replace(/\s*\|\s*Pracownia Ceramiki N.*$/i, '').trim() ||
    contentSections.find((s) => s.heading)?.heading ||
    page.title ||
    'Ceramika Nero';

  return (
    <div className="bg-surface-bg">
      <header className="mx-auto max-w-3xl px-4 pt-12 pb-6 text-center md:px-6 md:pt-16">
        <h1 className="font-heading text-3xl font-semibold text-accent-primary md:text-4xl">
          {heading.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>
      </header>

      {contentSections.map((section, index) => {
        const ctas = section.buttons
          .map((b) => {
            const resolved = resolveCtaHref(b.label, b.href);
            return {
              label: b.label.split('\n')[0]!.slice(0, 60),
              href: resolved.href,
              actionable: resolved.actionable,
            };
          })
          .filter((b) => b.actionable)
          .slice(0, 8);

        const knownHeadings =
          section.knownHeadings ?? knownHeadingsForSection(page.route, index);

        const bodyKnown = knownHeadings.filter(
          (h) =>
            !section.heading ||
            normalizeKey(h) !== normalizeKey(section.heading)
        );

        const bodyText = bodyTextWithoutHeading(section.heading, section.text);
        const hasImages = section.images.length > 0;
        const wide = hasImages || bodyText.length > 1200;

        return (
          <section
            key={`${section.heading ?? 'section'}-${index}`}
            className="border-t border-surface-subtle/30"
          >
            <div
              className={
                wide
                  ? 'mx-auto max-w-5xl px-4 py-10 md:px-6'
                  : 'mx-auto max-w-3xl px-4 py-10 md:px-6'
              }
            >
              {section.heading ? (
                <h2 className="font-heading text-2xl font-semibold text-accent-primary">
                  {section.heading.split('\n').map((line, i, arr) => (
                    <span key={i}>
                      {line}
                      {i < arr.length - 1 ? <br /> : null}
                    </span>
                  ))}
                </h2>
              ) : null}
              {bodyText ? (
                <ArchiveRichText text={bodyText} knownHeadings={bodyKnown} />
              ) : null}
              {hasImages ? (
                <div
                  className={
                    section.images.length === 1
                      ? 'mt-8'
                      : 'mt-8 grid gap-4 sm:grid-cols-2'
                  }
                >
                  {section.images.map((img) => (
                    <figure
                      key={img.src + img.alt}
                      className={
                        section.images.length === 1
                          ? 'relative mx-auto aspect-[4/3] w-full max-w-3xl'
                          : 'relative aspect-[4/3]'
                      }
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
              {ctas.length > 0 ? (
                <div className="mt-8 flex flex-wrap gap-3">
                  {ctas.map((b) => (
                    <CloneCta key={`${b.label}-${b.href}`} href={b.href}>
                      {b.label}
                    </CloneCta>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        );
      })}

      {bookingAdaptation ? (
        <section className="border-t border-surface-subtle/40 bg-[#f8ebe3] px-4 py-10 text-center md:px-6">
          <p className="mx-auto max-w-prose text-sm text-text-muted">
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
      className="mx-auto flex max-w-prose flex-wrap justify-center gap-3 px-4 pb-8"
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
