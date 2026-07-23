import { redirects } from './data';
import type { LegacyRedirect } from '@/lib/database/types';

export async function getBySourcePath(
  sourcePath: string
): Promise<LegacyRedirect | null> {
  return (
    redirects.find((redirect) => redirect.sourcePath === sourcePath) ?? null
  );
}
