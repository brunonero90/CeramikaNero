'use strict';

/**
 * Validate reference/original-site completeness.
 * Exits non-zero when required captures are missing or rendered HTML lacks content.
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/original-site-paths');

function exists(p) {
  return p && fs.existsSync(path.join(process.cwd(), p));
}

function fileSize(p) {
  try {
    return fs.statSync(path.join(process.cwd(), p)).size;
  } catch {
    return 0;
  }
}

function read(p) {
  return fs.readFileSync(path.join(process.cwd(), p), 'utf8');
}

function main() {
  const inventoryPath = path.join(ROOT, 'page-inventory.json');
  if (!fs.existsSync(inventoryPath)) {
    console.error('Missing page-inventory.json — run capture first.');
    process.exit(1);
  }

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const included = inventory.pages.filter(
    (p) => p.captureStatus !== 'excluded'
  );
  const failures = [];
  const warnings = [];

  for (const page of included) {
    const label = page.originalRoute;
    const required = [
      ['rawHtmlPath', page.rawHtmlPath],
      ['renderedHtmlPath', page.renderedHtmlPath],
      ['extractedContentPath', page.extractedContentPath],
      ['pageSpecPath', page.pageSpecPath],
      ['desktopScreenshotPath', page.desktopScreenshotPath],
      ['mobileScreenshotPath', page.mobileScreenshotPath],
    ];

    for (const [name, p] of required) {
      if (!exists(p)) {
        failures.push(`${label}: missing ${name} (${p})`);
      } else if (fileSize(p) < 50) {
        failures.push(`${label}: ${name} is empty/tiny (${fileSize(p)} bytes)`);
      }
    }

    if (exists(page.renderedHtmlPath)) {
      const html = read(page.renderedHtmlPath);
      const textish = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (textish.length < 80) {
        failures.push(
          `${label}: rendered HTML lacks meaningful text (${textish.length} chars)`
        );
      }
      if (
        /just a moment|cf-browser-verification|attention required/i.test(html)
      ) {
        failures.push(
          `${label}: rendered HTML looks like a challenge/interstitial`
        );
      }
      if (
        /<title[^>]*>\s*404\s*</i.test(html) ||
        /page not found/i.test(textish.slice(0, 200))
      ) {
        warnings.push(`${label}: possible 404/error page`);
      }
    }

    if (exists(page.extractedContentPath)) {
      const md = read(page.extractedContentPath);
      if (md.replace(/\s+/g, ' ').trim().length < 40) {
        failures.push(`${label}: content.md too short`);
      }
    }

    if (exists(page.pageSpecPath)) {
      try {
        const spec = JSON.parse(read(page.pageSpecPath));
        if (!Array.isArray(spec.sections) || spec.sections.length === 0) {
          warnings.push(`${label}: page-spec has no sections`);
        }
      } catch {
        failures.push(`${label}: page-spec.json is not valid JSON`);
      }
    }

    if (
      page.captureStatus === 'failed' ||
      page.captureStatus === 'partial-shell' ||
      page.captureStatus === 'failed-challenge'
    ) {
      failures.push(`${label}: captureStatus=${page.captureStatus}`);
    }
  }

  const placementPath = path.join(ROOT, 'image-placement.json');
  if (!fs.existsSync(placementPath)) {
    failures.push('Missing image-placement.json');
  } else {
    const placement = JSON.parse(fs.readFileSync(placementPath, 'utf8'));
    const unresolved = (placement.placements || []).filter(
      (p) => !p.resolvedLocally
    );
    if (unresolved.length) {
      warnings.push(
        `${unresolved.length} image placements unresolved locally (see image-placement.json)`
      );
    }
  }

  for (const required of [
    'design-system.json',
    'design-notes.md',
    'clone-gap-analysis.json',
    'clone-gap-analysis.md',
    'asset-manifest.json',
    'README.md',
  ]) {
    if (!fs.existsSync(path.join(ROOT, required))) {
      failures.push(`Missing ${required}`);
    }
  }

  const report = {
    validatedAt: new Date().toISOString(),
    includedPages: included.length,
    failures,
    warnings,
    ok: failures.length === 0,
  };

  fs.mkdirSync(path.join(ROOT, 'meta'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'meta', 'validation-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main();
