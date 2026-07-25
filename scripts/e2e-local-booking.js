/**
 * Browser E2E for BOOKING_LOCAL_MODE customer + local-admin journeys.
 * Does not mutate production Supabase.
 *
 * Usage:
 *   $env:BOOKING_LOCAL_MODE='1'; $env:BASE_URL='http://localhost:3010'; node scripts/e2e-local-booking.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:3010';
const OUT = path.join(process.cwd(), 'tmp', 'overnight-completion', 'e2e');
const ADMIN_SECRET = process.env.LOCAL_ADMIN_SECRET || 'local-dev-admin-secret';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function shot(page, name) {
  ensureDir(OUT);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function main() {
  ensureDir(OUT);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const report = {
    startedAt: new Date().toISOString(),
    base: BASE,
    steps: [],
    ok: true,
  };

  async function step(name, fn) {
    try {
      await fn();
      report.steps.push({ name, ok: true });
      console.log('OK', name);
    } catch (err) {
      report.ok = false;
      report.steps.push({
        name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      console.error('FAIL', name, err);
      await shot(page, `fail-${name.replace(/\s+/g, '-')}`).catch(() => {});
      throw err;
    }
  }

  try {
    await step('open homepage calendar', async () => {
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      await shot(page, '01-home');
      const banner = page.getByText(/TRYB LOKALNY|DANE TESTOWE/i);
      await banner.first().waitFor({ timeout: 15000 });
    });

    await step('open kalendarz', async () => {
      await page.goto(BASE + '/kalendarz', { waitUntil: 'networkidle' });
      await shot(page, '02-kalendarz');
      await page
        .getByRole('link', { name: /Zarezerwuj/i })
        .first()
        .waitFor({
          timeout: 15000,
        });
    });

    await step('open session detail', async () => {
      await page
        .getByRole('link', { name: /\[TEST\]/i })
        .first()
        .click();
      await page.waitForURL(/\/termin\//);
      await shot(page, '03-termin');
      await page.getByRole('link', { name: /Zarezerwuj/i }).click();
      await page.waitForURL(/\/rezerwacja/);
    });

    await step('complete booking form', async () => {
      await shot(page, '04-rezerwacja-form');
      await page
        .getByPlaceholder('Imię / nazwisko uczestnika')
        .fill('Jan Testowy');
      const age = page.getByPlaceholder('Wiek');
      if (await age.count()) {
        await age.fill('30');
      }
      await page.getByPlaceholder('Imię', { exact: true }).fill('Jan');
      await page.getByPlaceholder('Nazwisko', { exact: true }).fill('Testowy');
      await page
        .getByPlaceholder('Adres e-mail', { exact: true })
        .fill('jan.testowy@example.com');
      await page.getByPlaceholder('Telefon', { exact: true }).fill('600158318');
      await page
        .getByRole('checkbox', { name: /politykę prywatności/i })
        .check();
      await page
        .getByRole('button', { name: /Przejdź do podsumowania/i })
        .click();
      await page.getByText(/Podsumowanie rezerwacji/i).waitFor();
      await shot(page, '05-review');
      await page
        .getByRole('button', { name: /Potwierdź rezerwację|Rezerwuj i płać/i })
        .click();
      await page.waitForURL(/\/rezerwacja\/sukces/, { timeout: 30000 });
      await page
        .getByRole('heading', { name: /Dziękujemy za rezerwację/i })
        .waitFor({ timeout: 30000 });
      await page.waitForFunction(
        () => /CN-[A-Z0-9]+/.test(document.body.innerText),
        null,
        {
          timeout: 15000,
        }
      );
      await shot(page, '06-success');
      const body = await page.textContent('main');
      if (!body || !/CN-/.test(body)) {
        throw new Error('Missing booking reference on success page');
      }
      report.bookingReference = body.match(/CN-[A-Z0-9]+/)?.[0];
    });

    await step('verify capacity reduced on kalendarz', async () => {
      await page.goto(BASE + '/kalendarz', { waitUntil: 'networkidle' });
      await shot(page, '07-kalendarz-after');
    });

    await step('local admin login and inspect booking', async () => {
      await page.goto(BASE + '/admin/local', { waitUntil: 'networkidle' });
      await page.fill('input[name="password"]', ADMIN_SECRET);
      await page.getByRole('button', { name: /Zaloguj/i }).click();
      await page.waitForURL(/\/admin\/local\/dashboard/);
      await shot(page, '08-admin-dashboard');
      if (report.bookingReference) {
        await page
          .getByText(report.bookingReference, { exact: true })
          .first()
          .waitFor({ timeout: 10000 });
      }
      await page.getByText(/Outbox e-mail/i).waitFor();
    });

    await step('mobile booking smoke', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(BASE + '/kalendarz', { waitUntil: 'networkidle' });
      await shot(page, '09-kalendarz-mobile');
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 2;
      });
      if (overflow) {
        throw new Error('Horizontal overflow on mobile kalendarz');
      }
    });

    await step('social links present', async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      const fb = page.locator('a[href*="facebook.com/ceramikanero"]');
      const ig = page.locator('a[href*="instagram.com/ceramika_nero"]');
      if ((await fb.count()) < 1 || (await ig.count()) < 1) {
        throw new Error('Missing Facebook/Instagram header links');
      }
      await shot(page, '10-socials');
    });

    await step('legal pages render', async () => {
      await page.goto(BASE + '/regulamin', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { level: 1 }).waitFor();
      await shot(page, '11-regulamin');
      await page.goto(BASE + '/polityka-prywatnosci', {
        waitUntil: 'networkidle',
      });
      await page.getByRole('heading', { level: 1 }).waitFor();
      await shot(page, '12-polityka');
    });
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(OUT, 'report.json'),
      JSON.stringify(report, null, 2)
    );
    await browser.close();
  }

  if (!report.ok) {
    process.exitCode = 1;
  } else {
    console.log('E2E passed', report.bookingReference);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
