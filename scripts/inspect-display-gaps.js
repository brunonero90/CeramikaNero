const fs = require('fs');
const map = require('../tmp/wix-crawl/image-mapping.json');

const text = fs.readFileSync('lib/database/fixtures/media-assets.ts', 'utf8');
const homeIds = [...text.matchAll(/\['(wix-[^']+)', 'home'\]/g)].map(
  (m) => m[1]
);
console.log('home count', homeIds.length);
for (const id of homeIds) {
  const bare = id.replace(/^wix-/, '');
  const block = text.slice(
    text.indexOf(`id: '${id}'`),
    text.indexOf(`id: '${id}'`) + 500
  );
  const w = block.match(/width: (\d+)/);
  const h = block.match(/height: (\d+)/);
  console.log(id, w && w[1], h && h[1]);
}

const ids = [
  '747d6f_085171d978274d52ab228ceb93aa9847',
  '747d6f_31b0976c3c0e4cf3addf864e058110a2',
  '747d6f_6a39bd22cbe142c8a1aada6b04e8a120',
  '747d6f_d8f9b5306c68445f95b53ab86213c36b',
  '747d6f_dc55fa9a88ec400c852bddf31cc0b1c8',
  '747d6f_cd2460d4d3c1409b91c31dba9f7db804',
];
for (const id of ids) {
  const m = map.find((x) => x.id === id);
  console.log(
    JSON.stringify({
      id,
      dims: m?.dimensions,
      alt: m?.altTexts,
      size: m?.fileSizeBytes,
      pages: m?.pages?.slice(0, 2),
    })
  );
}
