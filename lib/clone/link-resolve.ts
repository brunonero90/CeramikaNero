/**
 * First-party link localization and CTA filtering for the clone.
 * Does not invent booking IDs — only rewrites known host/path patterns.
 */

const EXCLUDED_PATH =
  /^\/(about-2|forum|members|order-online|pricing-plans|refer-friends|referral|services-1|services\/(cosmetic|facial|foundations|manicure|skin))/i;

const NOISE_LABEL =
  /^(Udostępnij|Sortuj|Podgląd|0$|Zapisz się teraz|Akceptuję regulamin)/i;

const FOOTER_LABEL_NOISE =
  /^(©\s*\d{4}|Zapisując się do newslettera|Polityka prywatności\s*$)/i;

/** Map known original booking labels that only pointed at `#` or dead anchors. */
const LABEL_HREF_OVERRIDES: Record<string, string> = {
  'zobacz warunki': '/polityka-prywatnosci',
  'polityka prywatności': '/polityka-prywatnosci',
  regulamin: '/regulamin',
  kontakt: '/kontakt',
  blog: '/blog',
  galeria: '/galeria',
  'glina box': '/home',
  sklep: '/sklep',
  vouchery: '/vouchery',
  'gift card': '/gift-card',
  koszyk: '/cart',
};

export type ResolvedHref = {
  href: string;
  actionable: boolean;
  reason?: string;
};

export function localizeHref(href: string): string {
  if (!href) return '#';
  const trimmed = href.trim();
  if (trimmed === '#' || trimmed === '') return '#';
  if (
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('sms:')
  ) {
    return trimmed;
  }

  let h = trimmed.replace(/^https?:\/\/(www\.)?ceramikanero\.com/i, '');
  if (!h) h = '/';

  // External non-Wix / non-ceramika links kept as absolute
  if (/^https?:\/\//i.test(trimmed) && !/ceramikanero\.com/i.test(trimmed)) {
    if (/wix\.com|wixsite\.com|wixstatic\.com/i.test(trimmed)) {
      return '#';
    }
    return trimmed;
  }

  if (EXCLUDED_PATH.test(h)) return '/';
  if (/^\/profile\//i.test(h)) return '/blog';

  // Decode common encoded path segments for Next routes
  try {
    h = decodeURIComponent(h);
  } catch {
    // keep as-is
  }

  // ASCII aliases for unicode filesystem-safe public routes
  if (h === '/copy-of-panieński-opis') h = '/copy-of-panienski-opis';
  if (h === '/kopia-panieński-plus-opis') h = '/kopia-panienski-plus-opis';

  return h.startsWith('/') || h.startsWith('#') ? h : `/${h}`;
}

export function resolveCtaHref(label: string, href: string): ResolvedHref {
  const cleanLabel = label.replace(/\s+/g, ' ').trim();
  const localized = localizeHref(href);

  // Long privacy blob used as button label on Wix
  if (cleanLabel.length > 120) {
    return {
      href: '/polityka-prywatnosci',
      actionable: true,
      reason: 'privacy-blob-to-terms',
    };
  }

  if (NOISE_LABEL.test(cleanLabel) || FOOTER_LABEL_NOISE.test(cleanLabel)) {
    return { href: '#', actionable: false, reason: 'noise-label' };
  }

  // Wix accordion / expand controls incorrectly extracted as navigational links
  // when href is empty, hash, or bare "/". Real destinations keep the label.
  if (/^więcej szczegółów/i.test(cleanLabel)) {
    if (
      !localized ||
      localized === '#' ||
      localized === '/' ||
      localized.startsWith('/#')
    ) {
      return { href: '#', actionable: false, reason: 'accordion-not-link' };
    }
  }

  const isBookingLabel =
    /^(zarezerwuj|rezerwuj|rezerwuj termin|zarezerwuj warsztat|zapisz się)\b/i.test(
      cleanLabel
    );

  if (localized === '#' || !localized) {
    const override =
      LABEL_HREF_OVERRIDES[cleanLabel.toLowerCase()] ??
      LABEL_HREF_OVERRIDES[
        cleanLabel
          .toLowerCase()
          .replace(/\.\.\.$/, '')
          .trim()
      ];
    if (override) {
      return { href: override, actionable: true, reason: 'label-override' };
    }
    if (isBookingLabel) {
      return {
        href: '/kalendarz',
        actionable: true,
        reason: 'booking-label-empty-anchor',
      };
    }
    return { href: '#', actionable: false, reason: 'empty-anchor' };
  }

  if (/wix\.com|wixsite\.com/i.test(localized)) {
    return { href: '#', actionable: false, reason: 'wix-host' };
  }

  // Legacy homepage / dead self-links on booking CTAs → live calendar.
  if (isBookingLabel && (localized === '/' || localized.startsWith('/#'))) {
    return {
      href: '/kalendarz',
      actionable: true,
      reason: 'booking-label-home-fallback',
    };
  }

  if (/^\/booking-calendar(\/|$)/i.test(localized)) {
    return {
      href: '/kalendarz',
      actionable: true,
      reason: 'legacy-booking-calendar',
    };
  }

  return { href: localized, actionable: true };
}

export function isActionableCta(label: string, href: string): boolean {
  return resolveCtaHref(label, href).actionable;
}

/** Homepage service cards — destinations from archived index buttons. */
export const homepageServiceDestinations = [
  {
    titleKey: 'wrzesieńGLINA DO WINA PIĄTEK SUCHY LAS',
    moreHref: '/service-page/wrzesieńglina-do-wina-piątek-suchy-las',
    bookHref: '/booking-calendar/wrzesieńglina-do-wina-piątek-suchy-las',
  },
  {
    titleKey: 'wrzesieńCERAMIKA DLA DOROSŁYCH PON',
    moreHref: '/service-page/wrzesieńceramika-dla-dorosłych-pon',
    bookHref: '/booking-calendar/wrzesieńceramika-dla-dorosłych-pon',
  },
  {
    titleKey: 'GLINA DO WINA PIĄTEK 19.00 SUCHY LAS',
    moreHref: '/service-page/glina-do-wina-piątek-19-00-suchy-las',
    bookHref: '/booking-calendar/glina-do-wina-piątek-19-00-suchy-las',
  },
  {
    titleKey: 'CERAMIKA DLA DOROSŁYCH PON.CZW.',
    moreHref: '/service-page/ceramika-dla-dorosłych-pon-czw',
    bookHref: '/booking-calendar/ceramika-dla-dorosłych-pon-czw',
  },
  {
    titleKey: 'GLINA DO WINA W POZNANIU W PTASIM RADIU',
    moreHref: '/service-page/glina-do-wina-w-poznaniu-w-ptasim-radiu',
    bookHref: '/booking-calendar/glina-do-wina-w-poznaniu-w-ptasim-radiu',
  },
  {
    titleKey: '🌞🎨LETNIA AKADEMIA RYSUNKU, MALARSTWA',
    moreHref: '/service-page/letnia-akademia-rysunku-malarstwa',
    bookHref: '/booking-calendar/letnia-akademia-rysunku-malarstwa',
  },
  {
    titleKey: 'IV TURNUS PÓŁKOLONIE ARTYSTYCZNE',
    moreHref: '/service-page/iv-turnus-półkolonie-artystyczne',
    bookHref: '/service-page/iv-turnus-półkolonie-artystyczne',
  },
  {
    titleKey: 'GLINA I RODZINA SOBOTY 15.00',
    moreHref: '/service-page/glina-i-rodzina-soboty-15-00',
    bookHref: '/booking-calendar/glina-i-rodzina-soboty-15-00',
  },
  {
    titleKey: 'PORANKI Z CERAMIKĄ DLA DOROSŁYCH',
    moreHref: '/service-page/poranki-z-ceramiką-dla-dorosłych',
    bookHref: '/booking-calendar/poranki-z-ceramiką-dla-dorosłych',
  },
  {
    titleKey: 'PIKNIK RODZINNY Z CERAMIKĄ 29 sierpnia',
    moreHref: '/service-page/piknik-rodzinny-z-ceramiką-29-sierpnia',
    bookHref: '/service-page/piknik-rodzinny-z-ceramiką-29-sierpnia',
  },
  {
    titleKey: 'PIKNIK RODZINNY Z CERAMIKĄ 12 września',
    moreHref: '/service-page/piknik-rodzinny-z-ceramiką-12-września',
    bookHref: '/service-page/piknik-rodzinny-z-ceramiką-12-września',
  },
] as const;
