import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('seed-operational-data script', () => {
  const scriptPath = path.join(
    process.cwd(),
    'scripts/seed-operational-data.js'
  );
  const source = fs.readFileSync(scriptPath, 'utf8');

  it('refuses apply without project confirmation', () => {
    expect(source).toContain('SEED_CONFIRM_PROJECT_REF');
    expect(source).toContain('BRUNO_CONFIRM_PRODUCTION');
    expect(source).toContain('dry-run');
  });

  it('does not seed customers bookings payments or owners', () => {
    expect(source).not.toMatch(/from\('bookings'\)/);
    expect(source).not.toMatch(/from\('payments'\)/);
    expect(source).not.toMatch(/from\('customer_profiles'\)/);
    expect(source).not.toMatch(/from\('admin_users'\)/);
  });

  it('documents provisional business data as missing', () => {
    expect(source).toContain('workshop_sessions');
    expect(source).toContain('MISSING_FOR_BRUNO');
    expect(source).toContain('include-provisional');
  });

  it('uses stable category slugs for idempotency', () => {
    expect(source).toContain("slug: 'dla-dzieci'");
    expect(source).toContain("slug: 'glina-do-wina'");
    expect(source).toContain(".eq('slug'");
  });
});
