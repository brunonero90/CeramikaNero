import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import { PreviewBanner } from '@/app/admin/(protected)/components/preview-banner';
import { bookingAdaptationFor } from '@/lib/clone/archive';
import '@/lib/cms/static-registry';
import { resolveClonePage } from '@/lib/cms/resolve-page';
import { documentToArchivePage } from '@/lib/cms/document-adapters';

/**
 * Shared archive route renderer: published CMS → static fallback.
 * Draft/unpublished rows are visible only to authenticated admins.
 */
export async function ResolvedArchivePage({ route }: { route: string }) {
  const resolved = await resolveClonePage(route, { allowDraftPreview: true });
  const page = resolved ? documentToArchivePage(resolved.document) : null;
  if (!page) notFound();

  return (
    <>
      {resolved?.preview && <PreviewBanner entityType="strony" />}
      <ArchivePageView
        page={page}
        bookingAdaptation={bookingAdaptationFor(route) ?? undefined}
      />
    </>
  );
}

export async function resolvedArchiveTitle(
  route: string,
  fallback: string
): Promise<string> {
  const resolved = await resolveClonePage(route, { allowDraftPreview: true });
  return resolved?.document.title ?? fallback;
}
