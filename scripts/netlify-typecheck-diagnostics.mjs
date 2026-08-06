import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'typecheck', '--', '--pretty', 'false'], {
  encoding: 'utf8',
  env: process.env,
});
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
const escaped = output
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

await mkdir('diagnostics', { recursive: true });
await writeFile(
  'diagnostics/index.html',
  `<!doctype html><meta charset="utf-8"><title>TypeScript diagnostics</title><pre>${escaped || 'TYPECHECK PASSED'}</pre>`
);

console.log(`TypeScript exit code: ${result.status ?? 'unknown'}`);
console.log('Diagnostics published for this temporary preview.');
