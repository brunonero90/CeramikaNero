import { describe, expect, it } from 'vitest';
import { contactDisplayFromSettings } from '@/lib/public/contact-display';
import type { PublicSiteSettings } from '@/lib/database/domain';

const base: PublicSiteSettings = {
  studioName: 'Ceramika Nero',
  studioAddress: 'ul. Podgórna 3, Suchy Las',
  studioEmail: 'nerogosia@gmail.com',
  studioPhone: '532 279 101',
  whatsappUrl: 'https://wa.me/48532279101',
  facebookUrl: 'https://www.facebook.com/ceramikanero',
  instagramUrl: 'https://www.instagram.com/ceramika_nero',
  bankTransferInstructions: 'Konto po wycenie.',
  deliveryQuoteWording: 'Wysyłka do potwierdzenia.',
  publicNotice: 'Urlop 1–7 sierpnia',
  bookingCtaLabel: 'Zarezerwuj',
  defaultSeoTitle: 'Ceramika Nero',
  defaultSeoDescription: 'Warsztaty',
};

describe('contactDisplayFromSettings', () => {
  it('formats phone and WhatsApp message link from settings', () => {
    const d = contactDisplayFromSettings(base);
    expect(d.phoneHref).toBe('tel:+48532279101');
    expect(d.phoneDisplay).toBe('532 279 101');
    expect(d.whatsappUrl).toBe('https://wa.me/48532279101');
    expect(d.whatsappWithMessage).toContain('text=');
    expect(d.publicNotice).toBe('Urlop 1–7 sierpnia');
  });

  it('falls back to archive fixtures when settings missing', () => {
    const d = contactDisplayFromSettings(null);
    expect(d.phoneHref).toBe('tel:+48532279101');
    expect(d.email).toContain('@');
  });
});
