export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { WorkshopList } from '@/components/workshop/workshop-list';
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
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
            Dla dorosłych
          </h1>
          <p className="mt-4 text-text-muted">
            Wieczorne i weekendowe warsztaty ceramiczne dla dorosłych. Od
            pierwszych kroków po zaawansowane formy użytkowe.
          </p>
        </div>
        <div className="mt-12">
          <WorkshopList workshops={workshops} />
        </div>
      </div>
    </div>
  );
}
