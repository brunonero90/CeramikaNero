'use client';

import { useRef } from 'react';
import { useTheme } from '@/lib/theme/theme-context';
import type { Theme } from '@/lib/types/theme';

export function ThemeSuggestion({ theme }: { theme: Theme }) {
  const { setSuggestedTheme } = useTheme();
  const attempted = useRef<boolean>(null);

  if (attempted.current === null) {
    attempted.current = true;
    setSuggestedTheme(theme);
  }

  return null;
}
