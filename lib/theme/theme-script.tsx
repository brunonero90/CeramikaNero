'use client';

import {
  DEFAULT_THEME,
  THEME_SUGGESTION_DATA_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from '@/lib/types/theme';

/**
 * Synchronous inline script that restores the visitor's chosen theme before
 * the first paint to prevent visible theme flashing. It reads the manual
 * choice from localStorage first, then falls back to a server-supplied
 * category suggestion (data-theme-suggestion), and finally to the default.
 */
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
        var suggestion = document.documentElement.getAttribute("${THEME_SUGGESTION_DATA_ATTRIBUTE}");
        var theme = stored || suggestion || "${DEFAULT_THEME}";
        document.documentElement.setAttribute("data-theme", theme);
      } catch (e) {
        document.documentElement.setAttribute("data-theme", "${DEFAULT_THEME}");
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
