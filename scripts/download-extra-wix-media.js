const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { imageSize } = require('image-size');

const OUT = path.join('public', 'images', 'wix-migrated');
const inventory = JSON.parse(
  fs.readFileSync(path.join('tmp', 'wix-crawl', 'inventory.json'), 'utf8')
);
const mappingPath = path.join('tmp', 'wix-crawl', 'image-mapping.json');
const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
const existing = new Set(
  fs.readdirSync(OUT).map((f) => f.replace(/\.[^.]+$/, ''))
);

const found = inventory.inventory.filter(
  (i) => i.status === 'found' && /static\.wixstatic\.com\/media\//.test(i.url)
);

const byId = new Map();
for (const item of found) {
  const u = item.url;
  let m = u.match(/\/media\/(nsplsh_[a-f0-9]+)~mv2\.([a-z0-9]+)/i);
  if (!m) {
    m = u.match(/\/media\/([a-f0-9]{32})(?:~mv2)?\.([a-z0-9]+)/i);
  }
  if (!m) {
    m = u.match(
      /\/media\/([a-f0-9]+_[a-f0-9]+)(?:~mv2)?(?:_d_[^/.]+)?\.([a-z0-9]+)/i
    );
  }
  if (!m) continue;

  const id = m[1];
  const ext = m[2].toLowerCase();
  if (existing.has(id)) continue;

  if (!byId.has(id)) {
    let original;
    if (id.startsWith('nsplsh_')) {
      original = `https://static.wixstatic.com/media/${id}~mv2.${ext}`;
    } else if (!id.includes('_')) {
      original = `https://static.wixstatic.com/media/${id}.${ext}`;
    } else {
      original = `https://static.wixstatic.com/media/${id}~mv2.${ext}`;
    }
    byId.set(id, {
      ext,
      original,
      fallback: item.url,
      refs: [],
      alts: [],
    });
  }
  const entry = byId.get(id);
  entry.refs.push(...(item.references || []));
  entry.alts.push(...(item.references || []).map((r) => r.alt).filter(Boolean));
}

console.log('extra candidates', byId.size);

(async () => {
  let added = 0;
  for (const [id, entry] of byId) {
    let buf = null;
    let src = entry.original;
    for (const url of [entry.original, entry.fallback]) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!res.ok) continue;
        buf = Buffer.from(await res.arrayBuffer());
        src = url;
        break;
      } catch {
        // try next
      }
    }
    if (!buf) {
      console.log('FAIL', id);
      continue;
    }
    const filename = `${id}.${entry.ext}`;
    fs.writeFileSync(path.join(OUT, filename), buf);
    let dimensions = { width: 0, height: 0 };
    try {
      dimensions = imageSize(buf);
    } catch {
      // ignore
    }
    mapping.push({
      id,
      originalUrl: src,
      localPath: `/images/wix-migrated/${filename}`,
      filename,
      ext: entry.ext,
      dimensions,
      fileSizeBytes: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      pages: [...new Set(entry.refs.map((r) => r.page))],
      contexts: [...new Set(entry.refs.map((r) => r.context))],
      altTexts: [...new Set(entry.alts)],
      usageCategory: 'content',
      referenceCount: entry.refs.length,
      allVariantUrls: [entry.original, entry.fallback],
    });
    added += 1;
    console.log(
      'added',
      id,
      `${dimensions.width}x${dimensions.height}`,
      `${Math.round(buf.length / 1024)}kb`
    );
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(
    'added total',
    added,
    'mapping now',
    mapping.length,
    'files',
    fs.readdirSync(OUT).length
  );
})();
