/**
 * DOM/layout verification for homepage hero + header socials.
 * No screenshots, video, or traces.
 */
import { chromium } from 'playwright';

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
const widths = [1440, 1024, 768, 390];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`${BASE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const data = await page.evaluate(() => {
      const hero = document.querySelector('section[aria-label="Baner główny"]');
      const heroImg = hero?.querySelector('img');
      const cta = Array.from(document.querySelectorAll('a')).find((a) =>
        /Zobacz terminy/i.test(a.textContent || '')
      );
      const header = document.querySelector('header[data-chrome="site-header"]');
      const nav = header?.querySelector('nav[aria-label="Nawigacja główna"]');
      const fb = nav?.querySelector('a[aria-label="Facebook Ceramika Nero"]');
      const ig = nav?.querySelector('a[aria-label="Instagram Ceramika Nero"]');
      const absoluteSocial = header?.querySelector(
        '.pointer-events-none.absolute a[aria-label*="Facebook"]'
      );
      const doc = document.documentElement;
      const heroRect = hero?.getBoundingClientRect();
      const imgRect = heroImg?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();
      const styles = heroImg ? getComputedStyle(heroImg) : null;

      return {
        heroHeight: heroRect?.height ?? 0,
        imgObjectFit: styles?.objectFit ?? null,
        imgVisible: !!imgRect && imgRect.height > 40 && imgRect.width > 40,
        ctaVisible:
          !!ctaRect &&
          ctaRect.top < window.innerHeight &&
          ctaRect.bottom > 0,
        ctaInFirstViewport: !!ctaRect && ctaRect.top < window.innerHeight - 8,
        desktopNavSocials: {
          facebookInNav: !!fb,
          instagramInNav: !!ig,
          absoluteClusterPresent: !!absoluteSocial,
        },
        overflow: doc.scrollWidth - doc.clientWidth,
      };
    });

    const mobileMenu = width < 1024;
    if (mobileMenu) {
      const toggle = page.getByRole('button', { name: /Otwórz menu/i });
      if (await toggle.isVisible()) {
        await toggle.click();
        await page
          .getByRole('link', { name: /Facebook Ceramika Nero/i })
          .waitFor({ state: 'visible', timeout: 5000 });
      }
    }

    results.push({
      width,
      ...data,
      consoleErrors: consoleErrors.filter(
        (e) => !/Hydration|deprecated|Extra attributes/i.test(e)
      ),
    });

    await context.close();
  }

  await browser.close();

  let failed = false;
  for (const r of results) {
    const checks = [];
    if (r.overflow > 2) checks.push(`overflow ${r.overflow}`);
    if (!r.imgVisible) checks.push('hero image not visible');
    if (r.imgObjectFit !== 'contain') checks.push(`object-fit=${r.imgObjectFit}`);
    if (!r.ctaInFirstViewport) checks.push('CTA not in first viewport');
    if (r.width >= 1024) {
      if (!r.desktopNavSocials.facebookInNav)
        checks.push('FB missing from desktop nav');
      if (!r.desktopNavSocials.instagramInNav)
        checks.push('IG missing from desktop nav');
      if (r.desktopNavSocials.absoluteClusterPresent)
        checks.push('absolute social cluster still present');
      if (r.heroHeight > 760) checks.push(`hero too tall ${r.heroHeight}`);
    }
    if (r.consoleErrors.length) checks.push(`console: ${r.consoleErrors[0]}`);
    if (checks.length) {
      failed = true;
      console.error(`FAIL ${r.width}:`, checks.join('; '));
    } else {
      console.log(
        `OK ${r.width}: hero=${Math.round(r.heroHeight)}px fit=${r.imgObjectFit} cta=visible`
      );
    }
  }

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
