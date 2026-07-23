'use client';

import { useTheme } from '@/lib/theme/theme-context';
import { THEMES, type Theme } from '@/lib/types/theme';
import { cn } from '@/lib/utils/cn';

type ThemeSwitchProps = {
  className?: string;
};

const labels: Record<Theme, string> = {
  atelier: 'Atelier',
  joyful: 'Joyful',
};

const ariaLabels: Record<Theme, string> = {
  atelier: 'Wybierz motyw Atelier',
  joyful: 'Wybierz motyw Joyful',
};

export function ThemeSwitch({ className }: ThemeSwitchProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Wybór motywu wizualnego"
      className={cn(
        'inline-flex items-center rounded-full border border-surface-subtle/40 bg-surface-raised p-1 shadow-sm',
        className
      )}
    >
      {THEMES.map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={theme === item}
          aria-label={ariaLabels[item]}
          onClick={() => setTheme(item)}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised',
            theme === item
              ? 'bg-accent-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-primary hover:bg-surface-subtle/40'
          )}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  );
}
