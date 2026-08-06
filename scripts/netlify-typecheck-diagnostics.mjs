import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['run', 'typecheck', '--', '--pretty', 'false'], {
  encoding: 'utf8',
  env: process.env,
});
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();

await mkdir('public', { recursive: true });
await writeFile(
  'public/typecheck.txt',
  `${output || 'TYPECHECK PASSED'}\nExit code: ${result.status ?? 'unknown'}\n`
);

console.log(`TypeScript exit code: ${result.status ?? 'unknown'}`);
console.log('Diagnostics captured in public/typecheck.txt for this temporary preview.');
