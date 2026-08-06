import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'typecheck', '--', '--pretty', 'false'], {
  encoding: 'utf8',
  env: process.env,
});
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
const checkoutLines = output
  .split('\n')
  .filter((line) => line.includes('lib/cart/checkout.ts'))
  .join('\n');
const matches = /TS(?:2322|2339|2345|2769)\b/.test(checkoutLines);

await mkdir('public', { recursive: true });
await writeFile('public/index.html', '<p>TypeScript probe completed.</p>');
console.log(`TypeScript exit code: ${result.status ?? 'unknown'}`);
console.log(`Checkout diagnostic group A present: ${matches}`);
process.exit(matches ? 0 : 1);
