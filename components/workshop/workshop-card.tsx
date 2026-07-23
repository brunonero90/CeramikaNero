import { Button } from '@/components/ui/button';
import { formatGroszAsPln } from '@/lib/utils/money';
import type { WorkshopWithCategory } from '@/lib/database/types';

const ctaLabel = 'Zarezerwuj warsztat';

export function WorkshopCard({ workshop }: { workshop: WorkshopWithCategory }) {
  const isEnquiry = workshop.bookingMode === 'enquiry';
  const cta = isEnquiry ? 'Zapytaj o termin' : ctaLabel;
  const href = `/warsztaty/${workshop.slug}`;

  return (
    <article className="group flex flex-col rounded-lg bg-surface-raised p-6 shadow-sm transition-base hover:shadow-md">
      <h3 className="font-heading text-xl font-semibold text-text-primary">
        {workshop.title}
      </h3>
      <p className="mt-2 text-sm text-text-muted">
        {workshop.category?.name ?? 'Warsztat'}
      </p>
      <p className="mt-3 line-clamp-3 flex-1 text-text-primary">
        {workshop.shortDescription}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-muted">
        <span>{workshop.defaultDurationMinutes} min</span>
        {workshop.defaultPriceGrossGrosz > 0 && (
          <span className="font-medium text-text-primary">
            {formatGroszAsPln(workshop.defaultPriceGrossGrosz)}
          </span>
        )}
      </div>
      <div className="mt-6">
        <Button href={href} variant={isEnquiry ? 'outline' : 'primary'}>
          {cta}
        </Button>
      </div>
    </article>
  );
}
