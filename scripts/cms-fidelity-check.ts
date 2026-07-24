/**
 * Local structural + viewport fidelity check for proposed CMS pages.
 * Compares registry documents (static-fallback) to serialized seed records.
 * Optional Playwright screenshots when PLAYWRIGHT_FIDELITY=1 and base URL is up.
 *
 *   npx tsx scripts/cms-fidelity-check.ts
 *   PLAYWRIGHT_FIDELITY=1 BASE_URL=http://127.0.0.1:3000 npx tsx scripts/cms-fidelity-check.ts
 */
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import path from 'path';
import '@/lib/cms/static-registry';
import {
  fingerprintClonePageDocument,
  parseClonePageDocument,
} from '@/lib/cms/page-document';
import { getStaticClonePage } from '@/lib/cms/resolve-page';
import {
  documentToArchivePage,
  documentToGallery,
  documentToGlinaBox,
  documentToHomepageServices,
  documentToMarketingParts,
} from '@/lib/cms/document-adapters';

const RECORDS = path.join(process.cwd(), 'tmp/cms-import/revised/records');
const OUT = path.join(process.cwd(), 'tmp/cms-import/revised/fidelity');

type Diff = {
  slug: string;
  kind: string;
  detail: string;
};

function contentOutline(doc: ReturnType<typeof parseClonePageDocument>) {
  if (!doc) return null;
  return {
    template: doc.template,
    route: doc.route,
    title: doc.title,
    sectionTypes: doc.sections.map((s) => s.type),
    headings: doc.sections.flatMap((s) => {
      if (s.type === 'archive-section') return [s.heading];
      if (s.type === 'hero' || s.type === 'split-block') return [s.title];
      if (s.type === 'offer-intro') return [s.heading];
      if (s.type === 'homepage-header') return [s.title];
      if (s.type === 'mid-copy')
        return [s.workshopsHeading, s.contactHeading];
      if (s.type === 'bullet-list') return [s.heading];
      return [];
    }),
    imageSrcs: doc.sections.flatMap((s) => {
      if (s.type === 'archive-section') return s.images.map((i) => i.src);
      if (s.type === 'hero') return [s.imageSrc];
      if (s.type === 'split-block') return [s.imageSrc];
      if (s.type === 'gallery-grid') return s.images.map((i) => i.src);
      if (s.type === 'service-card') return [s.imageSrc];
      if (s.type === 'product-card') return [s.imageSrc];
      if (s.type === 'labeled-image') return [s.src];
      if (s.type === 'mid-copy') return [s.badgeSrc];
      return [];
    }),
    ctaHrefs: doc.sections.flatMap((s) => {
      if (s.type === 'archive-section') return s.buttons.map((b) => b.href);
      if (s.type === 'split-block') return s.ctaHref ? [s.ctaHref] : [];
      if (s.type === 'cta-block') return [s.href];
      if (s.type === 'product-card') return [s.href];
      if (s.type === 'service-card') return [s.href, s.moreHref];
      return [];
    }),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const diffs: Diff[] = [];
  const files = readdirSync(RECORDS).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    const record = JSON.parse(
      readFileSync(path.join(RECORDS, file), 'utf8')
    ) as { content: unknown };
    const seeded = parseClonePageDocument(JSON.stringify(record.content));
    const staticDoc = getStaticClonePage(slug);
    if (!seeded || !staticDoc) {
      diffs.push({
        slug,
        kind: 'missing',
        detail: !seeded ? 'seed parse failed' : 'static missing',
      });
      continue;
    }
    const fpSeed = fingerprintClonePageDocument(seeded);
    const fpStatic = fingerprintClonePageDocument(staticDoc);
    if (fpSeed !== fpStatic) {
      diffs.push({
        slug,
        kind: 'fingerprint',
        detail: `${createHash('sha256').update(fpSeed).digest('hex').slice(0, 12)} vs ${createHash('sha256').update(fpStatic).digest('hex').slice(0, 12)}`,
      });
    }
    const a = contentOutline(seeded);
    const b = contentOutline(staticDoc);
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push({
        slug,
        kind: 'outline',
        detail: 'section/heading/image/cta outline mismatch',
      });
    }
    // Adapter smoke: ensure view models build
    if (seeded.template === 'archive' && !documentToArchivePage(seeded)) {
      diffs.push({ slug, kind: 'adapter', detail: 'archive adapter failed' });
    }
    if (
      seeded.template === 'marketing-split' &&
      !documentToMarketingParts(seeded)
    ) {
      diffs.push({ slug, kind: 'adapter', detail: 'marketing adapter failed' });
    }
    if (
      seeded.template === 'homepage-services' &&
      !documentToHomepageServices(seeded)
    ) {
      diffs.push({ slug, kind: 'adapter', detail: 'homepage adapter failed' });
    }
    if (seeded.template === 'gallery' && !documentToGallery(seeded)) {
      diffs.push({ slug, kind: 'adapter', detail: 'gallery adapter failed' });
    }
    if (seeded.template === 'glina-box' && !documentToGlinaBox(seeded)) {
      diffs.push({ slug, kind: 'adapter', detail: 'glina-box adapter failed' });
    }
  }

  let screenshots: {
    attempted: boolean;
    note: string;
    captured?: string[];
  } = {
    attempted: false,
    note: 'Skipped (set PLAYWRIGHT_FIDELITY=1 with running Next server)',
  };

  if (process.env.PLAYWRIGHT_FIDELITY === '1') {
    const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
    const sampleRoutes = ['/', '/home', '/galeria', '/kontakt', '/pracownia'];
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch();
      const captured: string[] = [];
      for (const width of [1440, 390]) {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 900 },
        });
        for (const route of sampleRoutes) {
          await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
          const file = path.join(
            OUT,
            `static-fallback_${route.replace(/\W+/g, '_')}_${width}.png`
          );
          await page.screenshot({ path: file, fullPage: true });
          captured.push(file);
        }
        await page.close();
      }
      await browser.close();
      screenshots = {
        attempted: true,
        note: 'Captured static-fallback renders (DB empty ⇒ same as seed). Compare visually; no DB-backed delta until import.',
        captured,
      };
    } catch (err) {
      screenshots = {
        attempted: true,
        note: `Playwright failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    recordsChecked: files.length,
    materialDifferences: diffs,
    ok: diffs.length === 0,
    viewports: [1440, 390],
    screenshots,
    interpretation:
      'With empty remote content_pages, public pages already render static-fallback documents identical to proposed seed JSON. After import of identical fingerprints, DB-backed and static-fallback outlines remain equal.',
  };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (diffs.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
