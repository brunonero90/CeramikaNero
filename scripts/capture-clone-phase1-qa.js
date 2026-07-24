'use strict';

/**
 * Capture implementation screenshots for Phase 1 QA comparison.
 * Requires a running local server: npm run dev (default http://localhost:3000)
 *
 * Usage:
 *   node scripts/capture-clone-phase1-qa.js
 *   node scripts/capture-clone-phase1-qa.js --base=http://127.0.0.1:3000
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const base =
  (process.argv.find((a) => a.startsWith('--base=')) || '').split('=')[1] ||
  'http://127.0.0.1:3000';

const routes = [
  {
    name: 'index',
    path: '/',
    originalDesktop: 'index.png',
    originalMobile: 'index.png',
  },
  {
    name: 'pracownia',
    path: '/pracownia',
    originalDesktop: 'onas.png',
    originalMobile: 'onas.png',
  },
  {
    name: 'dla-dzieci',
    path: '/dla-dzieci',
    originalDesktop: 'dladzieci.png',
    originalMobile: 'dladzieci.png',
  },
  {
    name: 'dla-doroslych',
    path: '/dla-doroslych',
    originalDesktop: 'dladoroslych.png',
    originalMobile: 'dladoroslych.png',
  },
  {
    name: 'grupy-i-firmy',
    path: '/grupy-i-firmy',
    originalDesktop: 'dlafirm.png',
    originalMobile: 'dlafirm.png',
  },
  {
    name: 'galeria',
    path: '/galeria',
    originalDesktop: 'galeria.png',
    originalMobile: 'galeria.png',
  },
  {
    name: 'glinadowina',
    path: '/glinadowina',
    originalDesktop: 'glinadowina.png',
    originalMobile: 'glinadowina.png',
  },
  {
    name: 'urodziny',
    path: '/urodziny',
    originalDesktop: 'urodziny.png',
    originalMobile: 'urodziny.png',
  },
  {
    name: 'panienskie',
    path: '/panienskie',
    originalDesktop: 'panienskie.png',
    originalMobile: 'panienskie.png',
  },
  {
    name: 'home',
    path: '/home',
    originalDesktop: 'home.png',
    originalMobile: 'home.png',
  },
];

async function main() {
  const outRoot = path.join(process.cwd(), 'tmp', 'clone-phase1');
  fs.mkdirSync(outRoot, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const route of routes) {
    const dir = path.join(outRoot, route.name);
    fs.mkdirSync(dir, { recursive: true });

    const originalDesk = path.join(
      process.cwd(),
      'reference',
      'original-site',
      'screenshots',
      'desktop',
      route.originalDesktop
    );
    const originalMob = path.join(
      process.cwd(),
      'reference',
      'original-site',
      'screenshots',
      'mobile',
      route.originalMobile
    );
    if (fs.existsSync(originalDesk)) {
      fs.copyFileSync(originalDesk, path.join(dir, 'original-desktop.png'));
    }
    if (fs.existsSync(originalMob)) {
      fs.copyFileSync(originalMob, path.join(dir, 'original-mobile.png'));
    }

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
      });
      try {
        await page.goto(base + route.path, {
          waitUntil: 'networkidle',
          timeout: 60000,
        });
        await page.waitForTimeout(800);
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

    const comparison = [
      `# Phase 1 comparison — ${route.path}`,
      '',
      `- Original route artifacts: ${route.originalDesktop}`,
      `- Implemented route: ${route.path}`,
      `- Desktop: compare original-desktop.png vs implementation-desktop.png`,
      `- Mobile: compare original-mobile.png vs implementation-mobile.png`,
      '',
      '## Notes',
      '',
      '- Wix cookie banners / editor chrome are intentionally omitted.',
      '- Wix Bookings calendar widgets are replaced with first-party CTAs.',
      '- Newsletter submit is local-only (no external service).',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'comparison.md'), comparison);
    console.log('captured', route.path);
  }

  await browser.close();
  console.log('QA screenshots written under tmp/clone-phase1/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
