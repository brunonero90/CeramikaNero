'use client';

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from 'react';
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/types/theme';

const THEME_CHANGE_EVENT = 'ceramika-theme-change';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /**
   * Set a theme suggested by the current page category. This only applies when
   * the visitor has not made a manual choice, so user preference is always
   * respected. Suggestions are not persisted to localStorage.
   */
  setSuggestedTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function getSnapshot(): Theme {
  const dataTheme = document.documentElement.getAttribute('data-theme');
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const resolved = stored || dataTheme || DEFAULT_THEME;
  return isTheme(resolved) ? resolved : DEFAULT_THEME;
}

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener(THEME_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(THEME_CHANGE_EVENT, handler);
  };
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage may be unavailable in private mode or due to policies.
    }
    document.documentElement.setAttribute('data-theme', newTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const setSuggestedTheme = useCallback((suggestedTheme: Theme) => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!stored) {
      document.documentElement.setAttribute('data-theme', suggestedTheme);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setSuggestedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
