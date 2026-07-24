'use strict';
const p1 = require('../reference/original-site/implementation/phase1.json');
const p2 = require('../reference/original-site/implementation/phase2.json');
const fs = require('fs');
console.log('PHASE1', p1.status);
for (const r of p1.routes) {
  console.log(
    r.originalRoute,
    '→',
    r.implementedRoute,
    '|',
    r.verdict,
    '| text',
    r.matchedTextBlockCount + '/' + r.originalOrderedTextBlockCount,
    '| img',
    r.matchedContextualImageOccurrences +
      '/' +
      r.originalContextualImageOccurrences
  );
}
const by = {};
for (const r of p2.routes) by[r.verdict] = (by[r.verdict] || 0) + 1;
console.log('PHASE2', p2.status, by);
console.log(
  'blog posts',
  (fs.readFileSync('lib/clone/content/phase2/blog-posts.ts', 'utf8').match(/"slug":/g) || [])
    .length
);
console.log(
  'products',
  p2.routes.filter((r) => r.pageType === 'product').length
);
console.log(
  'shop pages',
  p2.routes.filter((r) => r.pageType === 'shop').length
);
console.log(
  'cart',
  p2.routes.filter((r) => r.pageType === 'cart').length
);
console.log(
  'legal+faq',
  p2.routes.filter((r) => r.pageType === 'legal' || r.pageType === 'faq')
    .length
);
console.log(
  'webinar+event',
  p2.routes.filter((r) => r.pageType === 'webinar' || r.pageType === 'event')
    .length
);
console.log(
  'service+booking+course',
  p2.routes.filter((r) => /service|booking|course/.test(r.pageType)).length
);
console.log(
  'incomplete',
  p2.routes.filter((r) => r.verdict === 'Incomplete').map((r) => r.originalRoute)
);
console.log(
  'blocked',
  p2.routes.filter((r) => r.verdict === 'Blocked').map((r) => r.originalRoute)
);
