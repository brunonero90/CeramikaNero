/**
 * Verified workshop catalog import candidates.
 * Prices from archived homepage cards where available; otherwise draft-only
 * with provisional fixture placeholders that require admin confirmation.
 * No scheduled sessions — future dates were not verified for the live calendar.
 */

export type CatalogImportWorkshop = {
  slug: string;
  title: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  bookingMode: 'scheduled' | 'enquiry' | 'external';
  /** Import as draft when business fields still need confirmation. */
  status: 'draft' | 'published';
  defaultPriceGrossGrosz: number;
  defaultCapacity: number;
  defaultDurationMinutes: number;
  minimumAge: number | null;
  maximumAge: number | null;
  suggestedTheme: 'atelier' | 'joyful' | null;
  priceProvenance: string;
  capacityProvenance: string;
  sourceRoutes: string[];
  needsCompletion: boolean;
  completionNotes: string;
};

export const catalogImportInstructors = [
  {
    slug: 'malgorzata-nero',
    displayName: 'Małgorzata Nero',
    biography:
      'Właścicielka Pracowni ceramiki Nero. Kontakt publiczny z archiwum strony.',
    provenance: 'archive siteContact / content footers (nerogosia@gmail.com)',
  },
] as const;

export const catalogImportWorkshops: CatalogImportWorkshop[] = [
  {
    slug: 'ceramika-dla-doroslych',
    title: 'Ceramika dla dorosłych',
    categorySlug: 'dla-doroslych',
    shortDescription:
      'Wieczorne i weekendowe warsztaty ceramiczne dla dorosłych.',
    description:
      'Warsztaty obejmują podstawowe techniki pracy z gliną. Oferta zgodna z archiwalnymi kartami rezerwacji i stroną Dla dorosłych.',
    bookingMode: 'scheduled',
    status: 'draft',
    defaultPriceGrossGrosz: 14900,
    defaultCapacity: 12,
    defaultDurationMinutes: 150,
    minimumAge: 18,
    maximumAge: null,
    suggestedTheme: 'atelier',
    priceProvenance:
      'reference/original-site/pages/index homepage card “149 zł” / “139 zł” — using 149 zł as listed variant; capacity from fixtures (unconfirmed)',
    capacityProvenance:
      'fixtures/seed.sql provisional — requires admin confirmation',
    sourceRoutes: [
      '/',
      '/dla-doroslych',
      '/service-page/ceramika-dla-dorosłych-pon-czw',
    ],
    needsCompletion: true,
    completionNotes:
      'Uzupełnij pojemność, czas trwania i opublikuj terminy w Terminy.',
  },
  {
    slug: 'glina-do-wina',
    title: 'Glina do wina',
    categorySlug: 'glina-do-wina',
    shortDescription: 'Wieczór z gliną i kieliszkiem wina dla dorosłych.',
    description:
      'Warsztaty Glina do wina — lepienie, szkliwienie, włoska atmosfera. Treść zgodna z /glinadowina i kartami usług.',
    bookingMode: 'scheduled',
    status: 'draft',
    defaultPriceGrossGrosz: 18900,
    defaultCapacity: 14,
    defaultDurationMinutes: 150,
    minimumAge: 18,
    maximumAge: null,
    suggestedTheme: 'atelier',
    priceProvenance:
      'homepage archive cards “189 zł” / “209 zł” — using 189 zł base listing; capacity provisional',
    capacityProvenance:
      'fixtures/seed.sql provisional — requires admin confirmation',
    sourceRoutes: [
      '/',
      '/glinadowina',
      '/service-page/glina-do-wina-piątek-19-00-suchy-las',
    ],
    needsCompletion: true,
    completionNotes: 'Potwierdź cenę wariantu (189 vs 209) i dodaj terminy.',
  },
  {
    slug: 'kurs-rysunku-malarstwa-ceramiki-6-10-lat',
    title: 'Kurs rysunku, malarstwa i ceramiki 6–10 lat',
    categorySlug: 'dla-dzieci',
    shortDescription: 'Kreatywny kurs dla dzieci w wieku 6–10 lat.',
    description:
      'Kurs łączący rysunek, malarstwo i ceramikę — oferta z archiwum /dla-dzieci.',
    bookingMode: 'scheduled',
    status: 'draft',
    defaultPriceGrossGrosz: 10900,
    defaultCapacity: 10,
    defaultDurationMinutes: 90,
    minimumAge: 6,
    maximumAge: 10,
    suggestedTheme: 'joyful',
    priceProvenance:
      'homepage “LETNIA AKADEMIA…” card “109 zł” (related children’s offer); confirm course fee in admin',
    capacityProvenance: 'fixtures provisional',
    sourceRoutes: ['/dla-dzieci', '/'],
    needsCompletion: true,
    completionNotes: 'Potwierdź cenę kursu vs oferty sezonowej i dodaj grafik.',
  },
  {
    slug: 'kurs-ceramiki-dla-mlodziezy-11',
    title: 'Kurs ceramiki dla młodzieży 11+',
    categorySlug: 'dla-dzieci',
    shortDescription: 'Kurs ceramiczny dla młodzieży 11+.',
    description: 'Oferta z archiwum strony Dla dzieci (grupa 11+).',
    bookingMode: 'scheduled',
    status: 'draft',
    defaultPriceGrossGrosz: 0,
    defaultCapacity: 10,
    defaultDurationMinutes: 120,
    minimumAge: 11,
    maximumAge: null,
    suggestedTheme: 'joyful',
    priceProvenance:
      'no explicit archive price — placeholder 0; must set before publish',
    capacityProvenance: 'fixtures provisional',
    sourceRoutes: ['/dla-dzieci'],
    needsCompletion: true,
    completionNotes: 'Ustaw cenę > 0 przed publikacją.',
  },
  {
    slug: 'glina-i-rodzina',
    title: 'Glina i rodzina',
    categorySlug: 'rodzinne',
    shortDescription: 'Sobotnie warsztaty rodzinne z gliną.',
    description:
      'Oferta z karty homepage “GLINA I RODZINA SOBOTY 15.00” (95 zł).',
    bookingMode: 'scheduled',
    status: 'draft',
    defaultPriceGrossGrosz: 9500,
    defaultCapacity: 12,
    defaultDurationMinutes: 120,
    minimumAge: null,
    maximumAge: null,
    suggestedTheme: 'joyful',
    priceProvenance: 'homepage archive card “95 zł”',
    capacityProvenance: 'fixtures provisional',
    sourceRoutes: ['/', '/service-page/glina-i-rodzina-soboty-15-00'],
    needsCompletion: true,
    completionNotes: 'Dodaj terminy sobotnie po potwierdzeniu pojemności.',
  },
  {
    slug: 'urodziny-ceramiczne',
    title: 'Urodziny ceramiczne',
    categorySlug: 'urodziny',
    shortDescription: 'Urodziny z ceramiką — oferta pakietowa.',
    description:
      'Pakiety urodzinowe z archiwum /urodziny. Rezerwacja przez kontakt (enquiry).',
    bookingMode: 'enquiry',
    status: 'draft',
    defaultPriceGrossGrosz: 0,
    defaultCapacity: 10,
    defaultDurationMinutes: 120,
    minimumAge: null,
    maximumAge: null,
    suggestedTheme: 'joyful',
    priceProvenance: 'package pricing varies — set per event in admin',
    capacityProvenance: 'fixtures provisional',
    sourceRoutes: [
      '/urodziny',
      '/kopia-urodziny-ceramika',
      '/kopia-panienski-plus-opis',
    ],
    needsCompletion: true,
    completionNotes: 'Ceny pakietów ustala admin; tryb enquiry.',
  },
  {
    slug: 'warsztaty-dla-firm',
    title: 'Warsztaty dla firm',
    categorySlug: 'grupy-i-firmy',
    shortDescription: 'Warsztaty integracyjne dla grup i firm.',
    description: 'Oferta z /grupy-i-firmy — wycena indywidualna (enquiry).',
    bookingMode: 'enquiry',
    status: 'draft',
    defaultPriceGrossGrosz: 0,
    defaultCapacity: 15,
    defaultDurationMinutes: 150,
    minimumAge: 18,
    maximumAge: null,
    suggestedTheme: 'atelier',
    priceProvenance: 'individual quote — no fixed archive price',
    capacityProvenance: 'fixtures provisional',
    sourceRoutes: ['/grupy-i-firmy'],
    needsCompletion: true,
    completionNotes: 'Enquiry only until capacity/price confirmed.',
  },
  {
    slug: 'wieczory-panienskie',
    title: 'Wieczory panieńskie',
    categorySlug: 'wieczory-panienskie',
    shortDescription: 'Pakiety panieńskie STANDARD / PLUS / VIP.',
    description:
      'Oferta z /panienskie oraz stron pakietów. Rezerwacja przez kontakt.',
    bookingMode: 'enquiry',
    status: 'draft',
    defaultPriceGrossGrosz: 0,
    defaultCapacity: 15,
    defaultDurationMinutes: 180,
    minimumAge: 18,
    maximumAge: null,
    suggestedTheme: 'joyful',
    priceProvenance: 'package-dependent — see webinar-registration pages',
    capacityProvenance: 'archive “od 5 do 15 osób” on STANDARD package',
    sourceRoutes: [
      '/panienskie',
      '/webinar-registration',
      '/copy-of-panienski-opis',
    ],
    needsCompletion: true,
    completionNotes: 'Ustaw pakiety/ceny lub prowadź jako enquiry.',
  },
];

/** Marketing / archive pages that must NOT become dated calendar sessions. */
export const marketingOnlyRoutes = [
  '/home',
  '/galeria',
  '/pracownia',
  '/kontakt',
  '/blog',
  '/sklep',
  '/cart',
  '/vouchery',
  '/gift-card',
  '/faq',
  '/regulamin',
  '/terms-conditions',
] as const;

/** Historical / Wix-dated service pages — do not publish as future sessions. */
export const historicalScheduleSourcesExcluded = [
  'All /booking-calendar/* and /service-page/* dated Wix Bookings shells — treated as service templates, not live session rows.',
  'seed.sql August 2026 sample sessions — provisional, not imported into active calendar.',
] as const;
