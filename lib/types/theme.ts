export const THEMES = ['atelier', 'joyful'] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'atelier';

export const THEME_STORAGE_KEY = 'ceramika-theme';

export const THEME_SUGGESTION_DATA_ATTRIBUTE = 'data-theme-suggestion';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && THEMES.includes(value as Theme);
}
