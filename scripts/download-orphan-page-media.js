/**
 * Download missing media discovered on sitemap orphan pages.
 * Does not integrate into UI — audit decides classification after download.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { imageSize } = require('image-size');
const https = require('https');
const http = require('http');

const OUT_DIR = path.join('public', 'images', 'wix-migrated');
const REPORT = path.join('tmp', 'wix-crawl', 'orphan-page-recovery.json');

const TARGETS = [
  {
    id: '747d6f_aa1bfec10d124209aa38d0d0dcbc1583',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/vouchery',
    note: 'Voucher page imagery',
  },
  {
    id: '747d6f_90fd3fe84ad246c3b4f72ead538bc878',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/courses',
    note: 'Courses listing imagery',
  },
  {
    id: '747d6f_8a2d596fd10b4cd98573ac95e0eb4e16',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/courses',
    note: 'Courses listing imagery',
  },
  {
    id: '747d6f_3c2b0ad9403c4fc98e4930a3a83ea21b',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/gift-card',
    note: 'Gift card page imagery',
  },
  {
    id: 'a3c153_20122b9a32cc4e9a9faca835b9f82d14',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 template/page asset — inspect after download',
  },
  {
    id: 'a3c153_bbf1019446e34069a3b96c18f172e810',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 template/page asset — inspect after download',
  },
  {
    id: '0fdef751204647a3bbd7eaa2827ed4f9',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 hex-id asset — likely Wix stock',
  },
  {
    id: 'c7d035ba85f6486680c2facedecdcf4d',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 hex-id asset — likely Wix stock',
  },
  {
    id: '6ea5b4a88f0b4f91945b40499aa0af00',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 hex-id asset — likely Wix stock',
  },
  {
    id: '01c3aff52f2a4dffa526d7a9843d46ea',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/about-2',
    note: 'about-2 hex-id asset — likely Wix stock',
  },
  {
    id: 'fc7570_bc49e99650ac4175bb5ea40d340ce055',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/services/glina-do-wina',
    note: 'Wix Beauty Spa template stock (Professional Makeup.jpg) — not Ceramika content',
    templateStock: true,
  },
  {
    id: 'fc7570_c6280744ca9f4db5830075a85810207e',
    ext: 'jpg',
    foundOn: 'https://www.ceramikanero.com/services/manicure',
    note: 'Wix Beauty Spa template stock (Manicure.jpg) — not Ceramika content',
    templateStock: true,
  },
];

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(
      url,
      {
        headers: { 'user-agent': 'CeramikaNero-image-audit/1.0' },
        timeout: 60000,
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchBuffer(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function candidateUrls(id, ext) {
  const urls = [];
  if (id.includes('_')) {
    urls.push(`https://static.wixstatic.com/media/${id}~mv2.${ext}`);
    urls.push(`https://static.wixstatic.com/media/${id}.${ext}`);
    for (const e of ['jpg', 'jpeg', 'png', 'webp']) {
      urls.push(`https://static.wixstatic.com/media/${id}~mv2.${e}`);
      urls.push(`https://static.wixstatic.com/media/${id}.${e}`);
    }
  } else {
    for (const e of ['jpg', 'jpeg', 'png', 'webp']) {
      urls.push(`https://static.wixstatic.com/media/${id}.${e}`);
      urls.push(`https://static.wixstatic.com/media/${id}~mv2.${e}`);
    }
  }
  return [...new Set(urls)];
}

function sniff(buf) {
  try {
    return imageSize(buf);
  } catch {
    return null;
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];

  for (const t of TARGETS) {
    const existing = fs
      .readdirSync(OUT_DIR)
      .find((f) => f.toLowerCase().startsWith(t.id.toLowerCase()));
    if (existing) {
      results.push({
        ...t,
        status: 'already-local',
        filename: existing,
      });
      continue;
    }

    let saved = null;
    let lastErr = null;
    for (const url of candidateUrls(t.id, t.ext)) {
      try {
        const buf = await fetchBuffer(url);
        const dim = sniff(buf);
        if (!dim || !dim.width) {
          lastErr = `non-image from ${url} (${buf.length} bytes)`;
          continue;
        }
        const outExt = dim.type === 'jpg' ? 'jpg' : dim.type || t.ext;
        const filename = `${t.id}.${outExt}`;
        const abs = path.join(OUT_DIR, filename);
        // Skip writing template stock into migrated set — record only
        if (t.templateStock) {
          results.push({
            ...t,
            status: 'template-stock-not-saved',
            sourceUrl: url,
            byteSize: buf.length,
            dimensions: dim,
            sha256: crypto.createHash('sha256').update(buf).digest('hex'),
          });
          saved = true;
          break;
        }
        fs.writeFileSync(abs, buf);
        results.push({
          ...t,
          status: 'downloaded',
          filename,
          localPath: `/images/wix-migrated/${filename}`,
          sourceUrl: url,
          byteSize: buf.length,
          dimensions: dim,
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        });
        saved = true;
        break;
      } catch (err) {
        lastErr = String(err.message || err);
      }
    }
    if (!saved) {
      results.push({ ...t, status: 'download-failed', error: lastErr });
    }
  }

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(
    REPORT,
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)
  );
  console.log(
    JSON.stringify(
      results.map((r) => ({
        id: r.id,
        status: r.status,
        filename: r.filename,
        dims: r.dimensions,
        err: r.error,
      })),
      null,
      2
    )
  );
})();
