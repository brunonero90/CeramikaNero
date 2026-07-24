export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
import { CategoryHero } from '@/components/workshop/category-hero';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { services } from '@/lib/database/factory';

export const metadata: Metadata = {
  title: 'Warsztaty dla dorosłych',
  description:
    'Warsztaty i kursy ceramiczne dla dorosłych w pracowni Ceramika Nero w Suchym Lesie.',
};

export default async function DlaDoroslychPage() {
  const [category, workshops] = await Promise.all([
    services.categories.getBySlug('dla-doroslych'),
    services.workshops.getByCategorySlug('dla-doroslych'),
  ]);

  return (
    <div className="px-4 py-16 md:py-24">
      {category?.suggestedTheme && (
        <ThemeSuggestion theme={category.suggestedTheme} />
      )}
      <div className="mx-auto max-w-7xl">
        <CategoryHero
          slug="dla-doroslych"
          title="Dla dorosłych"
          description="Wieczorne i weekendowe warsztaty ceramiczne dla dorosłych. Od pierwszych kroków po zaawansowane formy użytkowe."
        />
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
