'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = 'http://127.0.0.1:3000';
const routes = [
  {
    name: 'copy-of-panieński-opis',
    path: '/copy-of-panieński-opis',
    orig: 'copy-of-panieński-opis.png',
  },
  {
    name: 'kopia-panieński-plus-opis',
    path: '/kopia-panieński-plus-opis',
    orig: 'kopia-panieński-plus-opis.png',
  },
  {
    name: 'kopia-urodziny-ceramika',
    path: '/kopia-urodziny-ceramika',
    orig: 'kopia-urodziny-ceramika.png',
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const r of routes) {
    const dir = path.join('tmp/clone-phase2', r.name);
    fs.mkdirSync(dir, { recursive: true });
    for (const kind of ['desktop', 'mobile']) {
      const o = path.join('reference/original-site/screenshots', kind, r.orig);
      if (fs.existsSync(o)) {
        fs.copyFileSync(o, path.join(dir, `original-${kind}.png`));
      }
    }
    for (const vp of [
      { n: 'desktop', w: 1440, h: 900 },
      { n: 'mobile', w: 390, h: 844 },
    ]) {
      const page = await browser.newPage({
        viewport: { width: vp.w, height: vp.h },
      });
      await page.goto(base + encodeURI(r.path), {
        waitUntil: 'networkidle',
        timeout: 90000,
      });
      await page.screenshot({
        path: path.join(dir, `implementation-${vp.n}.png`),
        fullPage: true,
      });
      await page.close();
    }
    fs.writeFileSync(
      path.join(dir, 'comparison.md'),
      `# Closure QA — ${r.path}\n\nUnique public offer page implemented from archive.\n`
    );
    console.log('qa', r.path);
  }
  await browser.close();
})();
