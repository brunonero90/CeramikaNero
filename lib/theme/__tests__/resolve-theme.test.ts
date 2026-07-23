import { describe, expect, it } from 'vitest';
import { resolveSuggestedTheme } from '@/lib/theme/resolve-theme';

describe('suggested theme resolution', () => {
  it('uses the suggested theme when no manual choice exists', () => {
    expect(resolveSuggestedTheme(null, 'joyful')).toBe('joyful');
  });

  it('preserves a manual Atelier choice over a suggested Joyful theme', () => {
    expect(resolveSuggestedTheme('atelier', 'joyful')).toBe('atelier');
  });

  it('preserves a manual Joyful choice over a suggested Atelier theme', () => {
    expect(resolveSuggestedTheme('joyful', 'atelier')).toBe('joyful');
  });
});
