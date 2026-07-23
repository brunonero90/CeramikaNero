export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { services } from '@/lib/database/factory';

export const metadata: Metadata = {
  title: 'Warsztaty dla grup i firm',
  description:
    'Integracyjne warsztaty ceramiczne dla grup, firm i okazji specjalnych w pracowni Ceramika Nero.',
};

export default async function GrupyIFirmyPage() {
  const [category, workshops] = await Promise.all([
    services.categories.getBySlug('grupy-i-firmy'),
    services.workshops.getByCategorySlug('grupy-i-firmy'),
  ]);

  return (
    <div className="px-4 py-16 md:py-24">
      {category?.suggestedTheme && (
        <ThemeSuggestion theme={category.suggestedTheme} />
      )}
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
            Grupy i firmy
          </h1>
          <p className="mt-4 text-text-muted">
            Warsztaty ceramiczne dla firm, zespołów i grup. Dostosowujemy
            program, czas trwania i formę do Twoich potrzeb.
          </p>
        </div>
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
