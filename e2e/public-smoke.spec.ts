import { test, expect } from '@playwright/test';

/**
 * DOM-only public smoke. No screenshots, video, or traces.
 */
test.describe.configure({ mode: 'serial' });

test('homepage CTA reaches calendar; filters and catalog are usable', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Hero + desktop socials (DOM/layout only — no screenshots)
  const hero = page.locator('[aria-label="Baner główny"]');
  await expect(hero).toBeVisible();
  const heroBox = await hero.boundingBox();
  expect(heroBox?.height ?? 0).toBeGreaterThan(200);
  expect(heroBox?.height ?? 9999).toBeLessThan(900);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const fb = page.getByRole('navigation', { name: /Nawigacja główna/i }).getByRole(
    'link',
    { name: /Facebook Ceramika Nero/i }
  );
  const ig = page.getByRole('navigation', { name: /Nawigacja główna/i }).getByRole(
    'link',
    { name: /Instagram Ceramika Nero/i }
  );
  await expect(fb).toBeVisible();
  await expect(ig).toBeVisible();
  const navBox = await page
    .getByRole('navigation', { name: /Nawigacja główna/i })
    .boundingBox();
  const fbBox = await fb.boundingBox();
  if (navBox && fbBox) {
    expect(fbBox.y).toBeGreaterThanOrEqual(navBox.y - 8);
    expect(fbBox.y + fbBox.height).toBeLessThanOrEqual(navBox.y + navBox.height + 8);
  }

  const cta = page.getByRole('link', { name: /Zobacz terminy/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/kalendarz/);

  await page.goto('/');
  const other = page
    .getByRole('group', { name: /Filtr lokalizacji/i })
    .getByRole('button', { name: /Inne lokalizacje|Filtruj: inne/i })
    .first();
  if (await other.isVisible()) {
    await other.click();
    await expect(page).toHaveURL(/lokalizacja=/);
    await expect(other).toHaveAttribute('aria-pressed', 'true');
  }

  await page.goto('/warsztaty?filtr=dzieci');
  await expect(
    page.getByRole('heading', { name: 'Warsztaty', exact: true })
  ).toBeVisible();
  const filter = page.getByRole('button', { name: 'Dla dzieci', exact: true });
  if (await filter.isVisible()) {
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
  }

  await page.goto('/home');
  await expect(
    page.getByRole('heading', { name: 'Glina Box', exact: true })
  ).toBeVisible();
  await expect(page.getByText(/229/).first()).toBeVisible();

  await page.goto('/kontakt');
  await expect(
    page.getByRole('heading', { name: /Napisz do nas/i })
  ).toBeVisible();
  await expect(page.getByLabel(/Imię i nazwisko/i)).toBeVisible();

  await page.goto('/cart');
  await expect(
    page.getByRole('heading', { name: /Koszyk/i }).first()
  ).toBeVisible();

  // Soft console gate — ignore known Next/dev noise
  const critical = consoleErrors.filter(
    (e) =>
      !e.includes('Hydration') &&
      !e.includes('Extra attributes') &&
      !e.includes('deprecated') &&
      !e.includes('webpack-hmr') &&
      !e.includes('WebSocket connection')
  );
  expect(critical, critical.join('\n')).toEqual([]);
});

test('responsive widths have no meaningful horizontal overflow', async ({
  page,
}) => {
  const widths = [1440, 1024, 768, 390];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/',
      '/warsztaty',
      '/kalendarz',
      '/cart',
      '/kontakt',
    ]) {
      await page.goto(route);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
        };
      });
      expect(overflow.scrollWidth, `${route} @ ${width}`).toBeLessThanOrEqual(
        overflow.clientWidth + 2
      );
    }
  }
});
