import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SessionList } from './session-list';
import { formatGroszAsPln } from '@/lib/utils/money';
import type { WorkshopWithSessions } from '@/lib/database/types';
import { getWorkshopImage } from '@/lib/media/wix-catalog';

export function WorkshopDetail({
  workshop,
}: {
  workshop: WorkshopWithSessions;
}) {
  const isEnquiry = workshop.bookingMode === 'enquiry';
  const cta = isEnquiry ? 'Zapytaj o termin' : 'Zarezerwuj warsztat';
  const enquiryHref = `/kontakt?oferta=${encodeURIComponent(workshop.slug)}`;
  const bookHref = `/warsztaty/${workshop.slug}/rezerwacja`;
  const image = getWorkshopImage(
    workshop.slug,
    workshop.featuredMedia,
    workshop.featuredMediaId
  );

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 text-sm text-text-muted">
        <Link
          href="/warsztaty"
          className="hover:text-accent-primary hover:underline"
        >
          Warsztaty
        </Link>
        {workshop.category && (
          <>
            {' / '}
            <Link
              href={`/${workshop.category.slug}`}
              className="hover:text-accent-primary hover:underline"
            >
              {workshop.category.name}
            </Link>
          </>
        )}
      </div>

      {image && (
        <div className="relative mb-8 aspect-[16/9] w-full overflow-hidden">
          <Image
            src={image.src}
            alt={image.alt || workshop.title}
            fill
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className="object-cover"
          />
        </div>
      )}

      <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
        {workshop.title}
      </h1>

      {workshop.shortDescription && (
        <p className="mt-4 text-lg text-text-muted">
          {workshop.shortDescription}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-text-muted">
        <span>Czas trwania: {workshop.defaultDurationMinutes} min</span>
        {workshop.defaultPriceGrossGrosz > 0 && (
          <span className="text-lg font-medium text-text-primary">
            Od {formatGroszAsPln(workshop.defaultPriceGrossGrosz)}
          </span>
        )}
      </div>

      {workshop.description && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-text-primary">
            Opis warsztatu
          </h2>
          <p className="mt-2 whitespace-pre-line text-text-primary">
            {workshop.description}
          </p>
        </div>
      )}

      {workshop.practicalInformation && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-text-primary">
            Informacje praktyczne
          </h2>
          <p className="mt-2 whitespace-pre-line text-text-primary">
            {workshop.practicalInformation}
          </p>
        </div>
      )}

      {workshop.instructors.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-semibold text-text-primary">
            Prowadzący
          </h2>
          <ul className="mt-2 space-y-1">
            {workshop.instructors.map((instructor) => (
              <li key={instructor.id} className="text-text-primary">
                {instructor.displayName}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10" id="terminy">
        <h2 className="font-heading text-xl font-semibold text-text-primary">
          Nadchodzące terminy
        </h2>
        <div className="mt-4">
          <SessionList
            sessions={workshop.sessions}
            workshopSlug={workshop.slug}
          />
        </div>
      </div>

      <div className="mt-10 hidden md:block">
        {isEnquiry ? (
          <Button href={enquiryHref} variant="outline">
            {cta}
          </Button>
        ) : (
          <Button href={bookHref} variant="primary">
            {cta}
          </Button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-subtle/60 bg-surface-bg/95 p-3 backdrop-blur md:hidden">
        <Button
          href={isEnquiry ? enquiryHref : bookHref}
          variant={isEnquiry ? 'outline' : 'primary'}
          className="w-full"
        >
          {cta}
        </Button>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}
