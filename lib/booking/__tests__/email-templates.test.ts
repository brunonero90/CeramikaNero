import { describe, expect, it } from 'vitest';
import {
  buildAdminNotificationEmail,
  buildCustomerConfirmationEmail,
  formatWarsawDate,
} from '../email-templates';

const base = {
  reference: 'CN-TEST-001',
  workshopTitle: 'Glina do wina',
  sessionStartsAt: '2026-08-01T17:00:00.000Z',
  sessionLocation: 'ul. Podgórna 3, Suchy Las',
  quantity: 2,
  unitPriceGrossGrosz: 18900,
  totalGrossGrosz: 37800,
  customerEmail: 'tester@example.com',
  customerName: 'Anna Testowa',
  customerPhone: '+48111222333',
  customerNotes: 'Alergia na orzechy',
  participants: [
    { display_name: 'Anna', age: null },
    { display_name: 'Jan', age: 12 },
  ],
  siteUrl: 'https://ceramikanero.netlify.app',
  cancellationUrl: 'https://ceramikanero.netlify.app/anuluj?t=abc',
};

describe('booking email templates', () => {
  it('formats Warsaw-local dates in Polish', () => {
    const formatted = formatWarsawDate('2026-08-01T17:00:00.000Z');
    expect(formatted).toMatch(/2026/);
    expect(formatted.toLowerCase()).toMatch(/sierp|august|godz|\d{2}:\d{2}/i);
  });

  it('builds customer confirmation with payment and legal links', () => {
    const mail = buildCustomerConfirmationEmail(base);
    expect(mail.subject).toContain('CN-TEST-001');
    expect(mail.html).toContain('Glina do wina');
    expect(mail.html).toContain('30 1140 2004');
    expect(mail.html).toContain('/regulamin');
    expect(mail.html).toContain('/polityka-prywatnosci');
    expect(mail.text).toContain('378');
  });

  it('builds admin notification with contact and admin link', () => {
    const mail = buildAdminNotificationEmail(base);
    expect(mail.subject).toContain('CN-TEST-001');
    expect(mail.html).toContain('Anna Testowa');
    expect(mail.html).toContain('tester@example.com');
    expect(mail.html).toContain('+48111222333');
    expect(mail.html).toContain('/admin/rezerwacje');
    expect(mail.text).toContain('Alergia na orzechy');
  });
});
