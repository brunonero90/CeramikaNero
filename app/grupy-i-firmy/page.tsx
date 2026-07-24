export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
import { CategoryHero } from '@/components/workshop/category-hero';
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
        <CategoryHero
          slug="grupy-i-firmy"
          title="Grupy i firmy"
          description="Warsztaty ceramiczne dla firm, zespołów i grup. Dostosowujemy program, czas trwania i formę do Twoich potrzeb."
        />
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
