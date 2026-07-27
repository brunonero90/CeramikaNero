'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { useLocalCart } from '@/components/clone/local-cart';
import { primaryNavigation, siteContact } from '@/lib/fixtures/navigation';
import { getSocialIcon } from '@/lib/media/wix-catalog';
import { cn } from '@/lib/utils/cn';

const desktopNavigation = [
  { label: 'Warsztaty', href: '/warsztaty' },
  { label: 'Dla dzieci', href: '/dla-dzieci' },
  { label: 'Dla dorosłych', href: '/dla-doroslych' },
  { label: 'Grupy i firmy', href: '/grupy-i-firmy' },
  { label: 'Galeria', href: '/galeria' },
  { label: 'Blog', href: '/blog' },
] as const;

/** Warm editorial Atelier header used across the public site. */
export function Header({
  facebookUrl = siteContact.facebookUrl,
  instagramUrl = siteContact.instagramUrl,
}: {
  facebookUrl?: string;
  instagramUrl?: string;
} = {}) {
  const pathname = usePathname();
  const { itemCount: cartCount } = useLocalCart();
  const facebook = getSocialIcon('facebook');
  const instagram = getSocialIcon('instagram');

  return (
    <header
      className="relative z-50 border-b border-[#ddcbbb]/80 bg-[#fbf7ef]"
      data-chrome="site-header"
    >
      <div className="bg-[#b75d3e] px-4 py-2 text-center text-[10px] font-medium tracking-[0.11em] text-[#fffaf3] sm:text-xs">
        <span aria-hidden className="mr-2">
          ◇
        </span>
        Pracownia w Suchym Lesie. Autorskie warsztaty ceramiczne dla dzieci,
        dorosłych i grup.
      </div>
      <div className="mx-auto flex min-h-[70px] max-w-[1440px] items-center gap-3 px-4 py-2.5 md:px-6 lg:min-h-[82px]">
        <Link
          href="/"
          className="group inline-flex shrink-0 items-center gap-2.5 text-[#30231e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          aria-label="Ceramika Nero — strona główna"
        >
          <StudioMark />
          <span className="font-heading text-[1.65rem] font-medium leading-none tracking-[-0.02em] sm:text-[1.9rem]">
            Ceramika Nero
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-end gap-1 lg:flex xl:gap-2"
          aria-label="Nawigacja główna"
        >
          <ul className="flex flex-nowrap items-center justify-end">
            {desktopNavigation.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      'inline-block whitespace-nowrap px-2 py-2 text-[12px] font-medium text-[#453730] transition-base hover:text-[#b75d3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary xl:px-2.5 xl:text-[13px]',
                      active &&
                        'text-[#b75d3e] underline decoration-1 underline-offset-8'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {facebook ? (
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook Ceramika Nero"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <Image
                src={facebook.src}
                alt=""
                width={22}
                height={22}
                className="block h-[22px] w-[22px] object-contain opacity-75 transition-opacity hover:opacity-100"
              />
            </a>
          ) : null}
          {instagram ? (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram Ceramika Nero"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <Image
                src={instagram.src}
                alt=""
                width={22}
                height={22}
                className="block h-[22px] w-[22px] object-contain opacity-75 transition-opacity hover:opacity-100"
              />
            </a>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/kalendarz"
            className="hidden min-h-11 items-center justify-center rounded-md bg-[#b75d3e] px-4 text-[12px] font-semibold text-white transition-base hover:bg-[#a64e33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 xl:inline-flex xl:px-5 xl:text-[13px]"
          >
            Zarezerwuj warsztat
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center text-[#453730] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            aria-label={`Koszyk${cartCount ? `, ${cartCount} pozycji` : ''}`}
          >
            <CartIcon />
            <span className="absolute top-0.5 right-0.5 min-w-3.5 rounded-full bg-accent-primary px-1 text-center text-[10px] leading-4 font-semibold text-white">
              {cartCount}
            </span>
          </Link>

          <MobileNav
            key={pathname}
            facebookUrl={facebookUrl}
            instagramUrl={instagramUrl}
          />
        </div>
      </div>
    </header>
  );
}

function StudioMark() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="text-[#b75d3e]"
    >
      <path
        d="M8 13.5c3.8-5.9 13.6-7.4 20.3-2.5 3 2.2 4.5 5.4 3.7 8.5-.8 3.3-4.1 5.5-8 5.5-4.9 0-7.4-2.9-6.7-6 .5-2.4 2.9-3.7 5.2-3.2 2.1.5 3 2.6 2.3 4.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M9 14c-2.8 2.6-3.3 6.4-1.5 9.4 2.8 4.8 9.2 7.4 15.4 6.1 3.1-.7 5.6-2.2 7.1-4.4M10.5 30.5c4.5 2.4 11.4 2.6 16 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
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

function MobileNav({
  facebookUrl,
  instagramUrl,
}: {
  facebookUrl: string;
  instagramUrl: string;
}) {
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
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-[#8a6f62] text-[#453730] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
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
          className="atelier-paper absolute inset-x-0 top-full border-b border-surface-subtle bg-[#fbf7ef] px-4 py-4 shadow-md"
        >
          <nav aria-label="Menu mobilne">
            <ul className="flex flex-col gap-1">
              {primaryNavigation.map((item) => (
                <li key={`m-${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="block border-b border-[#ddcbbb]/50 px-2 py-3 text-sm font-medium text-[#453730] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
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
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-[#8a6f62] bg-white/50 px-4 text-sm font-medium text-[#453730]"
              onClick={() => setOpen(false)}
            >
              Zadzwoń
            </a>
            <Link
              href="/kalendarz"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#b75d3e] px-4 text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Zapisz się
            </Link>
            <div className="mt-2 flex items-center justify-center gap-4">
              {facebook ? (
                <a
                  href={facebookUrl}
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
                  href={instagramUrl}
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
