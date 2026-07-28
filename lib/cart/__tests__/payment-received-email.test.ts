import { describe, expect, it } from 'vitest';
import { buildOrderEmail } from '@/lib/email/catalog';
import { renderEmail } from '@/lib/email/render';
import { fixturePaymentConfirmed } from '@/lib/email/fixtures';

describe('payment_received email copy', () => {
  it('uses reassuring Polish subject, preheader and opening', async () => {
    const built = buildOrderEmail('payment_received', {
      ...fixturePaymentConfirmed,
      audience: 'customer',
    });
    expect(built.subject).toBe('Płatność potwierdzona — Ceramika Nero');
    expect(built.preheader).toMatch(/miejsce jest potwierdzone/i);

    const rendered = await renderEmail(built);
    expect(rendered.html).toContain('Płatność potwierdzona');
    expect(rendered.html).toMatch(/zrelaksować|ceramiczne spotkanie/i);
    expect(rendered.html).not.toContain('Stripe nie jest');
    expect(rendered.html).not.toContain('netlify.app');
    expect(rendered.text).toMatch(/CN-/);
  });
});
