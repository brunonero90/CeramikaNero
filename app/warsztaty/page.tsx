export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
import { services } from '@/lib/database/factory';

export const metadata: Metadata = {
  title: 'Warsztaty',
  description:
    'Warsztaty ceramiczne dla dzieci, dorosłych, rodzin i grup w pracowni Ceramika Nero w Suchym Lesie.',
};

export default async function WorkshopsPage() {
  const workshops = await services.workshops.getAll();

  return (
    <div className="px-4 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
            Warsztaty
          </h1>
          <p className="mt-4 text-text-muted">
            Wybierz warsztat dopasowany do wieku, doświadczenia i okazji.
            Wszystkie zajęcia prowadzimy w naszej pracowni w Suchym Lesie.
          </p>
        </div>
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
