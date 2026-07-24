export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
import { CategoryHero } from '@/components/workshop/category-hero';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { services } from '@/lib/database/factory';

export const metadata: Metadata = {
  title: 'Warsztaty dla dzieci',
  description:
    'Warsztaty ceramiczne dla dzieci w pracowni Ceramika Nero w Suchym Lesie.',
};

export default async function DlaDzieciPage() {
  const [category, workshops] = await Promise.all([
    services.categories.getBySlug('dla-dzieci'),
    services.workshops.getByCategorySlug('dla-dzieci'),
  ]);

  return (
    <div className="px-4 py-16 md:py-24">
      {category?.suggestedTheme && (
        <ThemeSuggestion theme={category.suggestedTheme} />
      )}
      <div className="mx-auto max-w-7xl">
        <CategoryHero
          slug="dla-dzieci"
          title="Dla dzieci"
          description="Kreatywne warsztaty ceramiczne i artystyczne dla dzieci. Bezpieczna przestrzeń, małe grupy i dużo radości z tworzenia."
        />
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
