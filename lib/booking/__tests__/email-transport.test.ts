import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock('../local-mode');
  vi.doUnmock('@/lib/resend/server');
});

describe('email transport', () => {
  it('returns soft ledger failure when Resend is not configured in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../local-mode', () => ({
      isBookingLocalMode: () => false,
      isResendConfigured: () => false,
    }));

    const { deliverBookingEmail } = await import('../email-transport');
    const result = await deliverBookingEmail({
      bookingId: 'b1',
      type: 'confirmation',
      to: 'a@example.com',
      subject: 't',
      html: '<p>t</p>',
      text: 't',
    });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe('ledger');
    expect(result.errorMessage).toMatch(/RESEND/i);
  });

  it('sends via Resend when configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../local-mode', () => ({
      isBookingLocalMode: () => false,
      isResendConfigured: () => true,
    }));
    vi.doMock('@/lib/resend/server', () => ({
      getResendClient: () => ({
        emails: {
          send: async () => ({ data: { id: 'msg_123' }, error: null }),
        },
      }),
      getResendFromEmail: () => 'rezerwacje@example.com',
      getResendReplyToEmail: () => 'kontakt@example.com',
    }));

    const { deliverBookingEmail } = await import('../email-transport');
    const result = await deliverBookingEmail({
      bookingId: 'b1',
      type: 'confirmation',
      to: 'a@example.com',
      subject: 't',
      html: '<p>t</p>',
      text: 't',
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('resend');
    expect(result.providerMessageId).toBe('msg_123');
  });

  it('maps provider failure without throwing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../local-mode', () => ({
      isBookingLocalMode: () => false,
      isResendConfigured: () => true,
    }));
    vi.doMock('@/lib/resend/server', () => ({
      getResendClient: () => ({
        emails: {
          send: async () => ({
            data: null,
            error: { message: 'provider down' },
          }),
        },
      }),
      getResendFromEmail: () => 'rezerwacje@example.com',
      getResendReplyToEmail: () => undefined,
    }));

    const { deliverBookingEmail } = await import('../email-transport');
    const result = await deliverBookingEmail({
      bookingId: 'b1',
      type: 'confirmation',
      to: 'a@example.com',
      subject: 't',
      html: '<p>t</p>',
      text: 't',
    });

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toMatch(/provider down/i);
  });
});
