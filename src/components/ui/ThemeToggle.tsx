'use client';

import React, { useSyncExternalStore } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isClient) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="p-1.5 rounded-lg text-foreground hover:bg-white/10 transition-colors"
      >
        <Sun className="h-4 w-4 opacity-0" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-1.5 rounded-lg text-foreground hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[#ffd700]" />
      ) : (
        <Moon className="h-4 w-4 text-gray-800 dark:text-gray-200" />
      )}
    </button>
  );
}

