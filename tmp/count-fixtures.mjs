import fs from 'fs';

const d = fs.readFileSync('lib/database/fixtures/data.ts', 'utf8');
function countExportArray(name) {
  const re = new RegExp('export const ' + name + '[^=]*=\\s*\\[');
  const m = d.match(re);
  if (!m) return 'missing';
  const start = d.indexOf(m[0]);
  const next = d.indexOf('export const ', start + m[0].length);
  const slice = next === -1 ? d.slice(start) : d.slice(start, next);
  return (slice.match(/\bid:\s*['"]/g) || []).length;
}
for (const n of [
  'categories',
  'instructors',
  'workshops',
  'sessions',
  'contentPages',
  'blogPosts',
  'galleryItems',
  'siteSettings',
  'redirects',
]) {
  console.log(n + ':', countExportArray(n));
}
const m = fs.readFileSync('lib/database/fixtures/media-assets.ts', 'utf8');
console.log('wixMediaAssets:', (m.match(/\bid:\s*['"]/g) || []).length);
