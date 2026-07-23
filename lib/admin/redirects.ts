import type { LegacyRedirect } from '@/lib/database/types';

/**
 * Detect a redirect loop or chain by walking the destination path until it
 * reaches a path that is not a redirect source or until it revisits a path.
 * Returns true if the proposed redirect would create a cycle.
 */
export function detectRedirectLoop(
  redirects: LegacyRedirect[],
  sourcePath: string,
  destinationPath: string
): boolean {
  let current = destinationPath;
  const visited = new Set<string>();
  while (current) {
    if (current === sourcePath) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    const next = redirects.find((r) => r.sourcePath === current);
    if (!next) break;
    current = next.destinationPath;
  }
  return false;
}
