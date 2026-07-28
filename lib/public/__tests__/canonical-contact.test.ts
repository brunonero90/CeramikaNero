import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { siteContact } from '@/lib/fixtures/navigation';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';

const sourceRoots = ['app', 'components', 'docs', 'lib', 'scripts'];
const sourceExtensions = new Set([
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
]);

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const resolved = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(resolved);
    return sourceExtensions.has(extname(entry.name)) ? [resolved] : [];
  });
}

describe('canonical public contact details', () => {
  it('uses the current email and phone in public fallbacks', () => {
    const contact = contactDisplayFromSettings(null);

    expect(siteContact.email).toBe('kontakt@ceramikanero.pl');
    expect(contact.email).toBe('kontakt@ceramikanero.pl');
    expect(contact.phoneDisplay).toBe('532 279 101');
    expect(contact.phoneHref).toBe('tel:+48532279101');
    expect(contact.whatsappUrl).toBe('https://wa.me/48532279101');
  });

  it('contains no legacy public contact details in runtime content', () => {
    const legacyEmails = [
      ['nerogosia', 'gmail.com'].join('@'),
      ['kontakt.ceramikanero', 'gmail.com'].join('@'),
      ['kontakt', 'ceramikanero.com'].join('@'),
    ];
    const legacyPhone = new RegExp(['600', '158', '318'].join('[^0-9]{0,3}'));
    const files = [
      ...sourceRoots.flatMap(sourceFiles),
      join('supabase', 'seed.sql'),
    ];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');

      for (const email of legacyEmails) {
        expect(content.toLowerCase(), file).not.toContain(email);
      }
      expect(content, file).not.toMatch(legacyPhone);
    }
  });
});
