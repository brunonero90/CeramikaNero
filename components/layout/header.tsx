'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { primaryNavigation, siteContact } from '@/lib/fixtures/navigation';
import { getSocialIcon } from '@/lib/media/wix-catalog';
import { cn } from '@/lib/utils/cn';
import { ThemeSwitch } from './theme-switch';

const linkClasses =
  'rounded-sm px-2 py-2 text-[11px] font-semibold tracking-wide text-text-primary uppercase transition-base hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary xl:px-2.5 xl:text-xs';

export function Header() {
  const pathname = usePathname();
  const facebook = getSocialIcon('facebook');
  const instagram = getSocialIcon('instagram');

  return (
    <header className="sticky top-0 z-50 border-b border-surface-subtle/40 bg-surface-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 md:px-5">
        <Link
          href="/"
          className="shrink-0 border border-accent-primary px-3 py-2 font-heading text-sm font-semibold tracking-wide text-accent-primary uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          Ceramika Nero
        </Link>

        <nav
          className="hidden items-center justify-center lg:flex lg:flex-1"
          aria-label="Nawigacja główna"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-0.5">
            {primaryNavigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      linkClasses,
                      active &&
                        'text-accent-primary underline underline-offset-4'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <a
              href={siteContact.phoneHref}
              className="inline-flex min-h-9 items-center bg-accent-primary px-3 text-xs font-semibold tracking-wide text-white uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              Zadzwoń!
            </a>
            <Link
              href="/"
              className="inline-flex min-h-9 items-center bg-accent-primary px-3 text-xs font-semibold tracking-wide text-white uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              Zapisz się
            </Link>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {facebook && (
              <a
                href={siteContact.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook Ceramika Nero"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              >
                <Image
                  src={facebook.src}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              </a>
            )}
            {instagram && (
              <a
                href={siteContact.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram Ceramika Nero"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              >
                <Image
                  src={instagram.src}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              </a>
            )}
          </div>
          <ThemeSwitch className="hidden xl:inline-flex" />
          <MobileNav key={pathname} />
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="inline-flex min-h-10 min-w-10 items-center justify-center border border-accent-primary text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="sr-only">{open ? 'Zamknij menu' : 'Otwórz menu'}</span>
        <span aria-hidden className="text-lg font-bold">
          {open ? '×' : '≡'}
        </span>
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-full border-b border-surface-subtle bg-surface-bg px-4 py-4 shadow-md"
        >
          <nav aria-label="Menu mobilne">
            <ul className="flex flex-col gap-1">
              {primaryNavigation.map((item) => (
                <li key={`m-${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="block px-2 py-3 text-sm font-semibold tracking-wide text-text-primary uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={siteContact.phoneHref}
              className="inline-flex min-h-11 items-center justify-center bg-accent-primary px-4 text-sm font-semibold text-white uppercase"
              onClick={() => setOpen(false)}
            >
              Zadzwoń!
            </a>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center bg-accent-primary px-4 text-sm font-semibold text-white uppercase"
              onClick={() => setOpen(false)}
            >
              Zapisz się
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
