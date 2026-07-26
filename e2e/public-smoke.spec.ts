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
  const cta = page.getByRole('link', { name: /Zobacz terminy/i }).first();
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/kalendarz/);

  await page.goto('/');
  const other = page.getByRole('button', { name: /Inne lokalizacje/i }).first();
  if (await other.isVisible()) {
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'true');
  }

  await page.goto('/warsztaty');
  await expect(page.getByRole('heading', { name: /Warsztaty/i })).toBeVisible();
  const filter = page.getByRole('button', { name: /Dla dzieci/i }).first();
  if (await filter.isVisible()) {
    await filter.click();
    await expect(page).toHaveURL(/filtr=dzieci/);
  }

  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Glina Box/i })).toBeVisible();
  await expect(page.getByText(/229/)).toBeVisible();

  await page.goto('/kontakt');
  await expect(
    page.getByRole('heading', { name: /Napisz do nas/i })
  ).toBeVisible();
  await expect(page.getByLabel(/Imię i nazwisko/i)).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /Koszyk/i })).toBeVisible();

  // Soft console gate — ignore known Next/dev noise
  const critical = consoleErrors.filter(
    (e) =>
      !e.includes('Hydration') &&
      !e.includes('Extra attributes') &&
      !e.includes('deprecated')
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
