import { getCurrentAdmin } from './auth';

/**
 * Returns true if the current request is authenticated as an active
 * administrator and therefore may view unpublished content. This is used by
 * public routes to support in-place preview without exposing a public preview
 * token.
 */
export async function isAdminPreviewAllowed(): Promise<boolean> {
  const admin = await getCurrentAdmin();
  return !!admin;
}
