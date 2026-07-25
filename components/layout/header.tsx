'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useLocalCart } from '@/components/clone/local-cart';
import { primaryNavigation, siteContact } from '@/lib/fixtures/navigation';
import { getSocialIcon } from '@/lib/media/wix-catalog';
import { cn } from '@/lib/utils/cn';

/**
 * Site header matched to archived Wix chrome:
 * peach bar (~97px), single-row title-case nav, peach active chip, cart.
 * Desktop CTAs + FB/IG sit as a top-right cluster (archive y≈28–160).
 */
export function Header() {
  const pathname = usePathname();
  const { itemCount: cartCount } = useLocalCart();
  const facebook = getSocialIcon('facebook');
  const instagram = getSocialIcon('instagram');

  return (
    <header className="relative z-50 bg-[#fbe5d6]" data-chrome="site-header">
      <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-center gap-2 px-3 py-2 md:min-h-[72px] md:px-6 md:py-2.5 lg:pr-44">
        <nav
          className="hidden min-w-0 flex-1 items-center justify-center lg:flex"
          aria-label="Nawigacja główna"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            {primaryNavigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      'inline-block px-2 py-1.5 text-[13px] font-medium text-[#5c4038] transition-base hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary',
                      active && 'bg-[#f0c4b4] text-[#4a2f28]'
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

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <Link
            href="/cart"
            className="relative inline-flex h-9 w-9 items-center justify-center text-[#5c4038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            aria-label={`Koszyk${cartCount ? `, ${cartCount} pozycji` : ''}`}
          >
            <CartIcon />
            <span className="absolute top-0.5 right-0.5 min-w-3.5 rounded-full bg-accent-primary px-1 text-center text-[10px] leading-4 font-semibold text-white">
              {cartCount}
            </span>
          </Link>

          <MobileNav key={pathname} />
        </div>
      </div>

      {/* Desktop floating CTAs + socials — archive top-right cluster */}
      <div className="pointer-events-none absolute top-2 right-3 z-[60] hidden flex-col items-end gap-2 lg:flex xl:right-5">
        <div className="pointer-events-auto flex items-start gap-2">
          <a
            href={siteContact.phoneHref}
            className="inline-flex min-h-10 flex-col items-center justify-center border border-[#8a5a4a] bg-[#f6d5c8] px-3 py-1 text-[11px] font-medium text-[#5c4038] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            <span>Zadzwoń</span>
            <PhoneIcon />
          </a>
          <Link
            href="/kalendarz"
            className="inline-flex min-h-10 flex-col items-center justify-center border border-[#8a5a4a] bg-[#f6d5c8] px-3 py-1 text-[11px] font-medium text-[#5c4038] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            <span>Zapisz się</span>
            <SignupIcon />
          </Link>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          {facebook ? (
            <a
              href={siteContact.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Ceramika Nero"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <Image
                src={facebook.src}
                alt=""
                width={28}
                height={28}
                className="block h-7 w-7 object-contain"
              />
            </a>
          ) : null}
          {instagram ? (
            <a
              href={siteContact.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Ceramika Nero"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <Image
                src={instagram.src}
                alt=""
                width={28}
                height={28}
                className="block h-7 w-7 object-contain"
              />
            </a>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
      className="mt-0.5"
    >
      <path d="M6.5 4.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 6.7 2 2 0 0 1 6.5 4.5Z" />
    </svg>
  );
}

function SignupIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden
      className="mt-0.5"
    >
      <path d="M4 20v-2.5A3.5 3.5 0 0 1 7.5 14h3" />
      <circle cx="10" cy="8" r="3" />
      <path d="M16 11v6M13 14h6" />
    </svg>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const facebook = getSocialIcon('facebook');
  const instagram = getSocialIcon('instagram');

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
        className="inline-flex min-h-10 min-w-10 items-center justify-center border border-[#8a5a4a] text-[#5c4038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
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
          className="absolute inset-x-0 top-full border-b border-surface-subtle bg-[#fbe5d6] px-4 py-4 shadow-md"
        >
          <nav aria-label="Menu mobilne">
            <ul className="flex flex-col gap-1">
              {primaryNavigation.map((item) => (
                <li key={`m-${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="block px-2 py-3 text-sm font-medium text-[#5c4038] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
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
              className="inline-flex min-h-11 items-center justify-center border border-[#8a5a4a] bg-[#f6d5c8] px-4 text-sm font-medium text-[#5c4038]"
              onClick={() => setOpen(false)}
            >
              Zadzwoń
            </a>
            <Link
              href="/kalendarz"
              className="inline-flex min-h-11 items-center justify-center border border-[#8a5a4a] bg-[#f6d5c8] px-4 text-sm font-medium text-[#5c4038]"
              onClick={() => setOpen(false)}
            >
              Zapisz się
            </Link>
            <div className="mt-2 flex items-center justify-center gap-4">
              {facebook ? (
                <a
                  href={siteContact.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook Ceramika Nero"
                  className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  onClick={() => setOpen(false)}
                >
                  <Image
                    src={facebook.src}
                    alt=""
                    width={28}
                    height={28}
                    className="block h-7 w-7 object-contain"
                  />
                </a>
              ) : null}
              {instagram ? (
                <a
                  href={siteContact.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram Ceramika Nero"
                  className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  onClick={() => setOpen(false)}
                >
                  <Image
                    src={instagram.src}
                    alt=""
                    width={28}
                    height={28}
                    className="block h-7 w-7 object-contain"
                  />
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
