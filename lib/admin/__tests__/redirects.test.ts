import { describe, expect, it } from 'vitest';
import { detectRedirectLoop } from '../redirects';
import type { LegacyRedirect } from '@/lib/database/types';

function makeRedirect(
  sourcePath: string,
  destinationPath: string
): LegacyRedirect {
  return {
    id: crypto.randomUUID(),
    sourcePath,
    destinationPath,
    statusCode: 301,
    notes: null,
  };
}

describe('detectRedirectLoop', () => {
  it('returns false for a plain redirect with no chain', () => {
    const redirects: LegacyRedirect[] = [makeRedirect('/old', '/new')];
    expect(detectRedirectLoop(redirects, '/other', '/new')).toBe(false);
  });

  it('detects a direct loop', () => {
    const redirects: LegacyRedirect[] = [];
    expect(detectRedirectLoop(redirects, '/a', '/a')).toBe(true);
  });

  it('detects an indirect loop through existing redirects', () => {
    const redirects: LegacyRedirect[] = [
      makeRedirect('/b', '/c'),
      makeRedirect('/c', '/a'),
    ];
    expect(detectRedirectLoop(redirects, '/a', '/b')).toBe(true);
  });

  it('detects a chain that revisits a path', () => {
    const redirects: LegacyRedirect[] = [
      makeRedirect('/a', '/b'),
      makeRedirect('/b', '/c'),
    ];
    expect(detectRedirectLoop(redirects, '/c', '/a')).toBe(true);
  });
});
