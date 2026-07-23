import type { ContentStatus } from '@/lib/database/types';

export function BlogPostStatusBadge({
  status,
  archivedAt,
}: {
  status: ContentStatus;
  archivedAt: string | null;
}) {
  if (archivedAt) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
        Zarchiwizowany
      </span>
    );
  }
  const labels: Record<ContentStatus, string> = {
    draft: 'Szkic',
    published: 'Opublikowany',
    archived: 'Zarchiwizowany',
  };
  const styles: Record<ContentStatus, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
