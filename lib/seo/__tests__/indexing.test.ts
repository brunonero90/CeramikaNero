import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('public indexing controls', () => {
  it('noindexes ceramikanero.pl by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl');
    vi.stubEnv('SITE_ALLOW_INDEXING', '');
    vi.stubEnv('SITE_NOINDEX', '');
    const { shouldDisallowPublicIndexing } = await import('../indexing');
    expect(shouldDisallowPublicIndexing()).toBe(true);
  });

  it('allows indexing on .pl when SITE_ALLOW_INDEXING=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl');
    vi.stubEnv('SITE_ALLOW_INDEXING', '1');
    const { shouldDisallowPublicIndexing } = await import('../indexing');
    expect(shouldDisallowPublicIndexing()).toBe(false);
  });

  it('does not noindex unrelated hosts by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.netlify.app');
    vi.stubEnv('SITE_NOINDEX', '');
    const { shouldDisallowPublicIndexing } = await import('../indexing');
    expect(shouldDisallowPublicIndexing()).toBe(false);
  });
});
