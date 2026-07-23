import { WorkshopCard } from './workshop-card';
import type { WorkshopWithCategory } from '@/lib/database/types';

export function WorkshopList({
  workshops,
}: {
  workshops: WorkshopWithCategory[];
}) {
  if (workshops.length === 0) {
    return (
      <div className="rounded-lg bg-surface-raised p-8 text-center shadow-sm">
        <p className="text-text-muted">
          Aktualnie nie mamy dostępnych warsztatów w tej kategorii.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {workshops.map((workshop) => (
        <WorkshopCard key={workshop.id} workshop={workshop} />
      ))}
    </div>
  );
}
