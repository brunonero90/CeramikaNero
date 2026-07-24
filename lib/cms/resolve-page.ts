import { isAdminPreviewAllowed } from '@/lib/admin/preview';
import { services } from '@/lib/database/factory';
import {
  parseClonePageDocument,
  type ClonePageDocument,
} from '@/lib/cms/page-document';
import { documentMatchesSlug } from '@/lib/cms/route-slug';

export type ResolvedClonePage = {
  document: ClonePageDocument;
  source: 'supabase' | 'static-fallback';
  slug: string;
  /** True when serving unpublished CMS content to an authenticated admin. */
  preview?: boolean;
};

type StaticLoader = () => ClonePageDocument | null;

const staticLoaders = new Map<string, StaticLoader>();

/** Register a fixture-backed document for fallback and import provenance. */
export function registerStaticClonePage(
  slug: string,
  loader: StaticLoader
): void {
  staticLoaders.set(slug.replace(/^\//, ''), loader);
}

export function getStaticClonePage(slug: string): ClonePageDocument | null {
  const key = slug.replace(/^\//, '');
  const loader = staticLoaders.get(key);
  return loader ? loader() : null;
}

/**
 * Prefer published Supabase content_pages JSON; fall back to verified static
 * fixtures when missing or invalid. Never throws for missing CMS rows.
 */
export async function resolveClonePage(
  routeOrSlug: string,
  options?: { allowDraftPreview?: boolean }
): Promise<ResolvedClonePage | null> {
  const slug = routeOrSlug.replace(/^\//, '') || 'root';
  const staticDoc = getStaticClonePage(slug);
  const allowDraft =
    options?.allowDraftPreview === true && (await isAdminPreviewAllowed());

  try {
    const page = await services.contentPages.getBySlug(slug, allowDraft);
    if (page?.content) {
      const doc = parseClonePageDocument(page.content);
      if (doc && documentMatchesSlug(doc, slug)) {
        const isPreview =
          page.status !== 'published' || page.archivedAt !== null;
        if (!isPreview || allowDraft) {
          return {
            document: doc,
            source: 'supabase',
            slug,
            preview: isPreview || undefined,
          };
        }
      } else if (page.content && !doc) {
        console.error('[cms] invalid clone-page-v1 for slug', slug);
      }
    }
  } catch (err) {
    console.error('[cms] resolveClonePage supabase error', slug, err);
  }

  if (staticDoc) {
    return { document: staticDoc, source: 'static-fallback', slug };
  }

  return null;
}

export function listRegisteredStaticSlugs(): string[] {
  return [...staticLoaders.keys()].sort();
}
