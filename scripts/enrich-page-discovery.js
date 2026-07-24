/**
 * Enrich page-discovery.json with classified sitemap orphans and recovery notes.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'tmp', 'wix-crawl');
const pd = JSON.parse(
  fs.readFileSync(path.join(OUT, 'page-discovery.json'), 'utf8')
);
const orphanRecovery = JSON.parse(
  fs.readFileSync(path.join(OUT, 'orphan-page-recovery.json'), 'utf8')
);

const orphanClassifications = [
  {
    url: 'https://www.ceramikanero.com/services/manicure',
    classification: 'excluded-wix-template-scaffold',
    reason:
      'Wix Beauty Spa template service page (Manicure.jpg stock). Not Ceramika Nero content. Template stock not saved.',
  },
  {
    url: 'https://www.ceramikanero.com/services/skin-product-consultation',
    classification: 'excluded-wix-template-scaffold',
    reason:
      'Wix Beauty Spa template leftover; not linked from Ceramika navigation crawl.',
  },
  {
    url: 'https://www.ceramikanero.com/services/cosmetic-laser',
    classification: 'excluded-wix-template-scaffold',
    reason: 'Wix Beauty Spa template leftover.',
  },
  {
    url: 'https://www.ceramikanero.com/services/foundations-workshop',
    classification: 'excluded-wix-template-scaffold',
    reason: 'Wix Beauty Spa template leftover.',
  },
  {
    url: 'https://www.ceramikanero.com/services/facial',
    classification: 'excluded-wix-template-scaffold',
    reason: 'Wix Beauty Spa template leftover.',
  },
  {
    url: 'https://www.ceramikanero.com/about-2',
    classification: 'excluded-wix-template-scaffold',
    reason:
      'Alternate Wix template About page with stock winter landscape and solid-black avatar placeholders. Not Ceramika atelier content. Template assets not retained in wix-migrated.',
  },
  {
    url: 'https://www.ceramikanero.com/pricing-plans/list',
    classification: 'excluded-wix-system-route',
    reason:
      'Wix Pricing Plans system route; not part of public Ceramika marketing crawl surface.',
  },
  {
    url: 'https://www.ceramikanero.com/members',
    classification: 'excluded-wix-system-route',
    reason: 'Wix Members area; auth-gated, not public content.',
  },
  {
    url: 'https://www.ceramikanero.com/forum',
    classification: 'excluded-wix-system-route',
    reason: 'Wix Forum system route.',
  },
  {
    url: 'https://www.ceramikanero.com/refer-friends',
    classification: 'excluded-wix-system-route',
    reason: 'Wix referral app route.',
  },
  {
    url: 'https://www.ceramikanero.com/referral',
    classification: 'excluded-wix-system-route',
    reason: 'Wix referral app route.',
  },
  {
    url: 'https://www.ceramikanero.com/order-online',
    classification: 'excluded-wix-system-route',
    reason: 'Wix Orders system route.',
  },
  {
    url: 'https://www.ceramikanero.com/services-1',
    classification: 'excluded-duplicate-or-alias',
    reason: 'Likely duplicate/alias of /services; not in primary nav crawl.',
  },
  {
    url: 'https://www.ceramikanero.com/services/glina-do-wina',
    classification: 'visited-equivalent-elsewhere',
    reason:
      'Service alias; primary Glina do wina content crawled under workshop/service-page routes. Unique image on this alias was Wix template stock (Professional Makeup.jpg) — excluded.',
  },
  {
    url: 'https://www.ceramikanero.com/vouchery',
    classification: 'missed-then-recovered',
    reason:
      'Not in original 71-page crawl. Probed during audit; recovered Ceramika asset 747d6f_aa1bfec10d124209aa38d0d0dcbc1583 into local store + gallery fixtures. No dedicated /vouchery route on new site — shown via /galeria.',
  },
  {
    url: 'https://www.ceramikanero.com/gift-card',
    classification: 'missed-then-recovered',
    reason:
      'Not in original crawl. Recovered 747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b. No /gift-card route on new site — shown via /galeria.',
  },
  {
    url: 'https://www.ceramikanero.com/courses',
    classification: 'missed-then-recovered',
    reason:
      'Not in original crawl. Recovered 747d6f_90fd3fe84ad246c3b4f72ead538bc878 and 747d6f_8a2d596fd10b4cd98573ac95e0eb4e16. Course listing maps to /warsztaty on new site; photos included in /galeria.',
  },
  {
    url: 'https://www.ceramikanero.com/courses/imprezy-zamknięte-do-10-os.-',
    classification: 'covered-by-equivalent-new-route',
    reason:
      'Wix Courses detail; workshop equivalents exist under /warsztaty. No unique missing Ceramika media beyond /courses listing recovery.',
  },
  {
    url: 'https://www.ceramikanero.com/courses/kręcenie-na-kole-',
    classification: 'covered-by-equivalent-new-route',
    reason: 'Wix Courses detail; covered by workshop routes.',
  },
  {
    url: 'https://www.ceramikanero.com/courses/glina-i-rodzina-',
    classification: 'covered-by-equivalent-new-route',
    reason: 'Wix Courses detail; covered by workshop routes.',
  },
  {
    url: 'https://www.ceramikanero.com/courses/glina-do-wina-',
    classification: 'covered-by-equivalent-new-route',
    reason: 'Wix Courses detail; covered by workshop routes.',
  },
  {
    url: 'https://www.ceramikanero.com/courses/pracowania-otwarta-',
    classification: 'covered-by-equivalent-new-route',
    reason: 'Wix Courses detail; covered by workshop routes.',
  },
  {
    url: 'https://www.ceramikanero.com/faq',
    classification: 'no-unique-content-images',
    reason:
      'Only branding/favicon/social icons; no additional photographic assets.',
  },
  {
    url: 'https://www.ceramikanero.com/dostawy-i-zwroty',
    classification: 'no-unique-content-images',
    reason: 'Legal/shipping text page; favicon only.',
  },
  {
    url: 'https://www.ceramikanero.com/services',
    classification: 'covered-by-equivalent-new-route',
    reason: 'Services index; category pages crawled separately.',
  },
  {
    url: 'https://www.ceramikanero.com/service-page/wrzesieńceramika-dla-dorosłych-pon',
    classification: 'covered-by-equivalent-new-route',
    reason:
      'Dated booking occurrence; workshop imagery covered via service-page crawl of similar workshops.',
  },
  {
    url: 'https://www.ceramikanero.com/service-page/wrzesieńglina-do-wina-piątek-suchy-las',
    classification: 'covered-by-equivalent-new-route',
    reason:
      'Dated booking occurrence; covered by Glina do wina workshop assets.',
  },
];

pd.orphanUrlClassifications = orphanClassifications;
pd.orphanRecoverySummary = {
  ceramikaAssetsDownloadedAndIntegrated: orphanRecovery.results.filter((r) =>
    [
      '747d6f_aa1bfec10d124209aa38d0d0dcbc1583',
      '747d6f_90fd3fe84ad246c3b4f72ead538bc878',
      '747d6f_8a2d596fd10b4cd98573ac95e0eb4e16',
      '747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b',
    ].includes(r.id)
  ).length,
  templateStockDetectedNotSaved: orphanRecovery.results.filter(
    (r) => r.status === 'template-stock-not-saved'
  ).length,
  templateAboutAssetsDiscarded: 6,
  note: 'Original crawl visited 71 raw / 70 canonical HTTPS pages. Sitemap listed 27 additional URLs; 4 genuine Ceramika photos were missing and recovered; remaining orphans are Wix template/system routes or already-covered workshop equivalents.',
};

fs.writeFileSync(
  path.join(OUT, 'page-discovery.json'),
  JSON.stringify(pd, null, 2)
);
console.log('page-discovery enriched');
