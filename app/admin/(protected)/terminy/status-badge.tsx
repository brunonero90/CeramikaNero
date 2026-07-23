import type { SessionStatus } from '@/lib/database/types';

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = {
    draft: 'Szkic',
    scheduled: 'Planowany',
    sold_out: 'Wyprzedany',
    cancelled: 'Odwołany',
    completed: 'Zakończony',
  };
  const styles: Record<SessionStatus, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-green-100 text-green-800',
    sold_out: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
