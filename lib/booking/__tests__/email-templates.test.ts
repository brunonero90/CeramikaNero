import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  buildAdminNotificationEmail,
  buildCancellationEmail,
  buildCustomerConfirmationEmail,
  formatWarsawDate,
  getBookingAdminEmail,
  getPublicSiteUrl,
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
  siteUrl: 'https://ceramikanero.pl',
  cancellationUrl: 'https://ceramikanero.pl/rezerwacja/anulowanie?t=abc',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('booking email templates', () => {
  it('formats Warsaw-local dates in Polish', () => {
    const formatted = formatWarsawDate('2026-08-01T17:00:00.000Z');
    expect(formatted).toMatch(/2026/);
    expect(formatted.toLowerCase()).toMatch(/sierp|august|godz|\d{2}:\d{2}/i);
  });

  it('builds customer confirmation with payment and absolute legal links', () => {
    const mail = buildCustomerConfirmationEmail(base);
    expect(mail.subject).toContain('CN-TEST-001');
    expect(mail.html).toContain('Glina do wina');
    expect(mail.html).toContain('30 1140 2004');
    expect(mail.html).toContain('https://ceramikanero.pl/regulamin');
    expect(mail.html).toContain('https://ceramikanero.pl/polityka-prywatnosci');
    expect(mail.html).toContain(base.cancellationUrl);
    expect(mail.text).toContain('378');
  });

  it('builds admin notification with contact and absolute admin link', () => {
    const mail = buildAdminNotificationEmail(base);
    expect(mail.subject).toContain('CN-TEST-001');
    expect(mail.html).toContain('Anna Testowa');
    expect(mail.html).toContain('tester@example.com');
    expect(mail.html).toContain('+48111222333');
    expect(mail.html).toContain('https://ceramikanero.pl/admin/rezerwacje');
    expect(mail.text).toContain('Alergia na orzechy');
  });

  it('builds cancellation with absolute contact and legal links', () => {
    const mail = buildCancellationEmail(base, 'Test anulacji');
    expect(mail.subject).toContain('CN-TEST-001');
    expect(mail.html).toContain('anulowana');
    expect(mail.html).toContain('Test anulacji');
    expect(mail.html).toContain('https://ceramikanero.pl/kontakt');
    expect(mail.html).toContain('https://ceramikanero.pl/regulamin');
    expect(mail.text).toContain('https://ceramikanero.pl/kontakt');
  });

  it('reads BOOKING_ADMIN_EMAIL and NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('BOOKING_ADMIN_EMAIL', 'kontakt@ceramikanero.pl');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ceramikanero.pl/');
    expect(getBookingAdminEmail()).toBe('kontakt@ceramikanero.pl');
    expect(getPublicSiteUrl()).toBe('https://ceramikanero.pl');
  });
});
