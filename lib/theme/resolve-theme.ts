import type { Theme } from '@/lib/types/theme';

/**
 * Resolve the active theme when a page or category suggests a default.
 * A visitor's manual choice always takes precedence over a suggestion.
 */
export function resolveSuggestedTheme(
  manualTheme: Theme | null,
  suggestedTheme: Theme
): Theme {
  return manualTheme || suggestedTheme;
}
