import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'typecheck', '--', '--pretty', 'false'], {
  encoding: 'utf8',
  env: process.env,
});
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
const matches = /lib\/cart\/checkout\.ts/.test(output);

await mkdir('public', { recursive: true });
await writeFile('public/index.html', '<p>TypeScript probe completed.</p>');
console.log(`TypeScript exit code: ${result.status ?? 'unknown'}`);
console.log(`Unified checkout diagnostics present: ${matches}`);
process.exit(matches ? 0 : 1);
