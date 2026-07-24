'use strict';

/**
 * Download unresolved Ceramika Wix media into reference/original-site/assets/media/
 * Does NOT modify public/images/wix-migrated or the production app.
 */

const fs = require('fs');
const path = require('path');
const { ROOT, extractWixMediaId } = require('./lib/original-site-paths');

async function download(url, dest) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'CeramikaNeroReferenceCapture/1.0',
      accept: 'image/*,*/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf.length;
}

function bestUrl(url) {
  // Prefer a reasonably sized fill variant; fall back to original URL
  return url;
}

async function main() {
  const placementPath = path.join(ROOT, 'image-placement.json');
  const placement = JSON.parse(fs.readFileSync(placementPath, 'utf8'));
  const manifestPath = path.join(ROOT, 'asset-manifest.json');
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : { assets: [], notes: [] };

  const mediaDir = path.join(ROOT, 'assets', 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const toFetch = new Map();
  for (const p of placement.placements) {
    if (p.resolvedLocally) continue;
    if (!/static\.wixstatic\.com\/media\//i.test(p.originalWixUrl || ''))
      continue;
    const id = p.mediaId || extractWixMediaId(p.originalWixUrl);
    if (!id) continue;
    if (!toFetch.has(id)) toFetch.set(id, p.originalWixUrl);
  }

  const results = [];
  for (const [id, url] of toFetch) {
    const extMatch = url.match(/\.(jpe?g|png|webp|gif|avif)/i);
    const ext = (extMatch ? extMatch[1] : 'jpg')
      .toLowerCase()
      .replace('jpeg', 'jpg');
    const filename = `${id}.${ext}`;
    const dest = path.join(mediaDir, filename);
    const localPath = `/reference-assets/media/${filename}`;
    const relPath = path
      .relative(process.cwd(), dest)
      .split(path.sep)
      .join('/');
    try {
      if (!fs.existsSync(dest)) {
        const size = await download(bestUrl(url), dest);
        results.push({ id, ok: true, bytes: size, path: relPath });
      } else {
        results.push({
          id,
          ok: true,
          bytes: fs.statSync(dest).size,
          path: relPath,
          cached: true,
        });
      }
      // Update all placements with this mediaId
      for (const p of placement.placements) {
        if (p.mediaId === id || extractWixMediaId(p.originalWixUrl) === id) {
          p.localPath = relPath;
          p.resolvedLocally = true;
          p.resolutionNote =
            'Downloaded into reference/original-site/assets/media during archive capture (not production public/).';
        }
      }
      manifest.assets.push({
        type: 'image',
        mediaId: id,
        originalUrl: url,
        localPath: relPath,
        storedInReference: true,
        provenance:
          'downloaded during reference capture for unresolved course/page media',
      });
    } catch (err) {
      results.push({ id, ok: false, error: String(err.message || err), url });
    }
  }

  // Classify remaining unresolved
  for (const p of placement.placements) {
    if (p.resolvedLocally) continue;
    if (/graph\.facebook\.com/i.test(p.originalWixUrl || '')) {
      p.exception =
        'Third-party Facebook profile image; not archived into production. Replace with local author photo when cloning.';
    } else if (/parastorage\.com.*googleMap/i.test(p.originalWixUrl || '')) {
      p.exception =
        'Wix Google Maps editor element asset; recreate map via first-party embed without Wix runtime.';
    } else {
      p.exception = p.exception || 'Unresolved media; see capture notes.';
    }
  }

  placement.unresolvedCount = placement.placements.filter(
    (p) => !p.resolvedLocally
  ).length;
  placement.occurrenceCount = placement.placements.length;
  placement.updatedAt = new Date().toISOString();
  fs.writeFileSync(placementPath, JSON.stringify(placement, null, 2));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(
    path.join(ROOT, 'meta', 'reference-media-download.json'),
    JSON.stringify({ downloadedAt: new Date().toISOString(), results }, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        attempted: toFetch.size,
        results,
        unresolvedRemaining: placement.unresolvedCount,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
