'use strict';
const fs = require('fs');
const t = fs.readFileSync('lib/clone/content/phase2/archive-pages.ts', 'utf8');
const keys = [...t.matchAll(/"(\/[^"]+)": \{/g)].map((m) => m[1]);
console.log(keys.join('\n'));
console.log('COUNT', keys.length);
