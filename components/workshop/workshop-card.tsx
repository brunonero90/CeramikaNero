import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { formatGroszAsPln } from '@/lib/utils/money';
import type { WorkshopWithCategory } from '@/lib/database/types';
import { getWorkshopImage } from '@/lib/media/wix-catalog';

export function WorkshopCard({ workshop }: { workshop: WorkshopWithCategory }) {
  const isEnquiry = workshop.bookingMode === 'enquiry';
  const cta = isEnquiry ? 'Zapytaj o termin' : 'Wybierz termin';
  const href = isEnquiry
    ? `/kontakt?oferta=${encodeURIComponent(workshop.slug)}`
    : `/warsztaty/${workshop.slug}`;
  const image = getWorkshopImage(workshop.slug, workshop.featuredMediaId);
  const locationLabel =
    workshop.slug === 'glina-do-wina-w-poznaniu-w-ptasim-radiu'
      ? 'Ptasie Radio, Poznań'
      : 'Suchy Las';

  return (
    <article className="group flex flex-col overflow-hidden border border-surface-subtle/40 bg-surface-raised transition-base hover:shadow-md">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent-highlight/40">
        {image ? (
          <Image
            src={image.src}
            alt={image.alt || workshop.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold tracking-wide text-accent-primary uppercase">
          {workshop.category?.name ?? 'Warsztat'} · {locationLabel}
        </p>
        <h3 className="mt-2 font-heading text-xl font-semibold text-text-primary">
          {workshop.title}
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-text-muted">
          {workshop.shortDescription}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
          <span>{workshop.defaultDurationMinutes} min</span>
          {workshop.defaultPriceGrossGrosz > 0 ? (
            <span className="font-medium text-text-primary">
              {isEnquiry
                ? 'Wycena indywidualna'
                : `od ${formatGroszAsPln(workshop.defaultPriceGrossGrosz)}`}
            </span>
          ) : (
            <span className="font-medium text-text-primary">
              Wycena indywidualna
            </span>
          )}
        </div>
        <div className="mt-5">
          <Button href={href} variant={isEnquiry ? 'outline' : 'primary'}>
            {cta}
          </Button>
        </div>
      </div>
    </article>
  );
}
