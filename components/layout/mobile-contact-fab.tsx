'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { siteContact } from '@/lib/fixtures/navigation';
import { cn } from '@/lib/utils/cn';

const WHATSAPP_DIGITS = '48532279101';
const WHATSAPP_MESSAGE = encodeURIComponent(
  'Dzień dobry, chciałabym/chciałbym zapytać o warsztaty Ceramika Nero.'
);

/**
 * Fixed mobile call / WhatsApp actions. Hidden on lg+ where header already
 * exposes telephone CTA. Number provenance: lib/fixtures/navigation siteContact
 * (archive-verified 532 279 101).
 */
export function MobileContactFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname?.startsWith('/admin')) {
    return null;
  }

  const telHref = siteContact.phoneHref;
  const waHref = `https://wa.me/${WHATSAPP_DIGITS}?text=${WHATSAPP_MESSAGE}`;

  return (
    <div
      className="pointer-events-none fixed right-0 bottom-0 z-40 flex flex-col items-end gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
      data-testid="mobile-contact-fab"
    >
      <div
        className={cn(
          'pointer-events-auto flex flex-col items-end gap-2 transition-all duration-200',
          open
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0'
        )}
        aria-hidden={!open}
      >
        <a
          href={telHref}
          className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-md bg-accent-primary px-4 py-3 text-sm font-semibold tracking-wide text-white uppercase shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
          aria-label={`Zadzwoń: ${siteContact.phoneDisplay}`}
        >
          Zadzwoń
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 min-w-12 items-center gap-2 rounded-md border border-accent-primary bg-surface-bg px-4 py-3 text-sm font-semibold tracking-wide text-accent-primary uppercase shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
          aria-label="Napisz na WhatsApp"
        >
          WhatsApp
        </a>
      </div>
      <button
        type="button"
        className="pointer-events-auto inline-flex min-h-14 min-w-14 items-center justify-center rounded-md bg-accent-primary px-3 text-sm font-semibold tracking-wide text-white uppercase shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls="mobile-contact-actions"
        aria-label={open ? 'Zamknij kontakt' : 'Kontakt — telefon i WhatsApp'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '×' : 'Kontakt'}
      </button>
      <div id="mobile-contact-actions" className="sr-only">
        Telefon {siteContact.phoneDisplay}, WhatsApp
      </div>
    </div>
  );
}

export const mobileContactTargets = {
  tel: siteContact.phoneHref,
  whatsapp: `https://wa.me/${WHATSAPP_DIGITS}`,
  whatsappWithMessage: `https://wa.me/${WHATSAPP_DIGITS}?text=${WHATSAPP_MESSAGE}`,
  display: siteContact.phoneDisplay,
  provenance: 'lib/fixtures/navigation.ts siteContact (archive)',
} as const;
