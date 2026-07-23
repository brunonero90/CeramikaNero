/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const { existsSync, renameSync } = require('fs');
const { join } = require('path');

const ref = process.env.SUPABASE_PROJECT_REF;

if (!ref) {
  console.error(
    'Error: SUPABASE_PROJECT_REF environment variable is required.'
  );
  console.error(
    'Set it to your Supabase project reference (the part before .supabase.co in the project URL).'
  );
  console.error(
    'Example: set SUPABASE_PROJECT_REF=your-project-ref && npm run db:types'
  );
  process.exit(1);
}

// Generated types are written to a separate file. The barrel at
// lib/database/types.ts is hand-maintained: it imports from the generated
// file and from lib/database/domain.ts, so regenerating the database types
// never erases custom application/domain types.
const outputPath = join(
  __dirname,
  '..',
  'lib',
  'database',
  'generated-types.ts'
);
const backupPath = `${outputPath}.backup`;

if (existsSync(outputPath)) {
  renameSync(outputPath, backupPath);
}

const command = `supabase gen types typescript --project-id ${ref} --schema public > "${outputPath}"`;
console.log(`Running: ${command}`);

try {
  execSync(command, { stdio: 'inherit', shell: true });
  console.log(`Types written to ${outputPath}`);
  console.log(
    'Remember to keep lib/database/types.ts as a barrel that imports generated-types and domain types.'
  );
} catch {
  console.error('Type generation failed. Restoring backup if present.');
  if (existsSync(backupPath)) {
    renameSync(backupPath, outputPath);
  }
  process.exit(1);
}
