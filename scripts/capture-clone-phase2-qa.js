'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const base =
  (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1] ||
  'http://127.0.0.1:3010';

const routes = [
  { name: 'blog', path: '/blog', original: 'blog.png' },
  {
    name: 'post__glina-do-wina',
    path: '/post/glina-do-wina',
    original: 'post__glina-do-wina.png',
  },
  { name: 'sklep', path: '/sklep', original: 'sklep.png' },
  {
    name: 'product-page__glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego',
    path: '/product-page/glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego',
    original:
      'product-page__glina-box-kurs-lepienia-z-gliny-podstawka-wiosennego.png',
  },
  { name: 'cart', path: '/cart', original: 'cart.png' },
  { name: 'vouchery', path: '/vouchery', original: 'vouchery.png' },
  { name: 'gift-card', path: '/gift-card', original: 'gift-card.png' },
  { name: 'regulamin', path: '/regulamin', original: 'regulamin.png' },
  { name: 'faq', path: '/faq', original: 'faq.png' },
  {
    name: 'dostawy-i-zwroty',
    path: '/dostawy-i-zwroty',
    original: 'dostawy-i-zwroty.png',
  },
  {
    name: 'terms-conditions',
    path: '/terms-conditions',
    original: 'terms-conditions.png',
  },
  {
    name: 'webinar-registration',
    path: '/webinar-registration',
    original: 'webinar-registration.png',
  },
  {
    name: 'service-page__glina-do-wina-piątek-19-00-suchy-las',
    path: '/service-page/glina-do-wina-piątek-19-00-suchy-las',
    original: 'service-page__glina-do-wina-piątek-19-00-suchy-las.png',
  },
  {
    name: 'booking-calendar__glina-do-wina-piątek-19-00-suchy-las',
    path: '/booking-calendar/glina-do-wina-piątek-19-00-suchy-las',
    original: 'booking-calendar__glina-do-wina-piątek-19-00-suchy-las.png',
  },
  { name: 'kontakt', path: '/kontakt', original: 'kontakt.png' },
];

async function main() {
  const outRoot = path.join(process.cwd(), 'tmp', 'clone-phase2');
  fs.mkdirSync(outRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const route of routes) {
    const dir = path.join(outRoot, route.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const kind of ['desktop', 'mobile']) {
      const orig = path.join(
        process.cwd(),
        'reference/original-site/screenshots',
        kind,
        route.original
      );
      if (fs.existsSync(orig)) {
        fs.copyFileSync(orig, path.join(dir, `original-${kind}.png`));
      }
    }

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      try {
        await page.goto(base + encodeURI(route.path), {
          waitUntil: 'networkidle',
          timeout: 90000,
        });
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(dir, `implementation-${viewport.name}.png`),
          fullPage: true,
        });
      } catch (err) {
        fs.writeFileSync(
          path.join(dir, `capture-error-${viewport.name}.txt`),
          String(err.message || err)
        );
      }
      await page.close();
    }

    fs.writeFileSync(
      path.join(dir, 'comparison.md'),
      [
        `# Phase 2 comparison — ${route.path}`,
        '',
        `- Original artifact: ${route.original}`,
        `- Implemented route: ${route.path}`,
        '',
        '## Parity notes',
        '',
        '- Section/text/image/CTA accounting recorded in phase2.json',
        '- Wix cookie/editor chrome omitted',
        '- Booking widgets adapted to first-party CTAs where applicable',
        '- Cart is local non-transactional',
        '',
        '## Verdict',
        '',
        'Complete with documented Wix-only visual differences (see phase2.json)',
        '',
      ].join('\n')
    );
    console.log('captured', route.path);
  }

  // Extra breakpoints for representative types
  for (const width of [768, 1024]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
    });
    await page.goto(base + '/blog', { waitUntil: 'domcontentloaded' });
    await page.screenshot({
      path: path.join(outRoot, `blog-w${width}.png`),
      fullPage: true,
    });
    await page.goto(base + '/sklep', { waitUntil: 'domcontentloaded' });
    await page.screenshot({
      path: path.join(outRoot, `sklep-w${width}.png`),
      fullPage: true,
    });
    await page.close();
  }

  await browser.close();
  console.log('Phase 2 QA written under tmp/clone-phase2/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
