'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from './theme-switch';
import { primaryNavigation } from '@/lib/fixtures/navigation';

const menuItemClasses =
  'block rounded-md px-3 py-3 text-lg font-medium text-text-primary transition-base hover:bg-surface-subtle/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary';

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-base"
    >
      {open ? (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      ) : (
        <>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </>
      )}
    </svg>
  );
}

export function MobileNavigation() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-navigation-menu"
        aria-label={open ? 'Zamknij menu' : 'Otwórz menu'}
        className="rounded-md p-2 text-text-primary transition-base hover:bg-surface-subtle/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      >
        <MenuIcon open={open} />
      </button>

      {open && (
        <div
          id="mobile-navigation-menu"
          className="fixed inset-x-0 top-[4.5rem] z-40 flex flex-col border-b border-surface-subtle/30 bg-surface-bg/95 p-6 shadow-lg backdrop-blur-md"
        >
          <nav aria-label="Menu mobilne" className="flex flex-col gap-2">
            {primaryNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={menuItemClasses}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 flex flex-col gap-4 border-t border-surface-subtle/30 pt-6">
            <ThemeSwitch className="self-start" />
            <Button
              href="/warsztaty"
              variant="primary"
              onClick={() => setOpen(false)}
              className="w-full"
            >
              Zarezerwuj warsztat
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
