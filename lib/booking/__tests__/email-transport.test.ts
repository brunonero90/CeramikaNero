import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock('../local-mode');
  vi.doUnmock('@/lib/resend/server');
});

describe('email transport', () => {
  it(
    'returns soft ledger failure when Resend is not configured in production',
    async () => {
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
    },
    15_000
  );

  it('requires Reply-To and passes it to Resend on success', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const send = vi.fn(async () => ({ data: { id: 'msg_123' }, error: null }));
    vi.doMock('../local-mode', () => ({
      isBookingLocalMode: () => false,
      isResendConfigured: () => true,
    }));
    vi.doMock('@/lib/resend/server', () => ({
      getResendClient: () => ({ emails: { send } }),
      getResendFromEmail: () => 'Ceramika Nero <rezerwacje@ceramikanero.pl>',
      getResendReplyToEmail: () => 'kontakt@ceramikanero.pl',
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
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Ceramika Nero <rezerwacje@ceramikanero.pl>',
        replyTo: 'kontakt@ceramikanero.pl',
        to: 'a@example.com',
      })
    );
  });

  it('maps provider failure without throwing and does not invent a message id', async () => {
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
      getResendFromEmail: () => 'Ceramika Nero <rezerwacje@ceramikanero.pl>',
      getResendReplyToEmail: () => 'kontakt@ceramikanero.pl',
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
    expect(result.providerMessageId).toBeNull();
    expect(result.errorMessage).toMatch(/provider down/i);
  });

  it('maps thrown Resend errors as soft failures', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.doMock('../local-mode', () => ({
      isBookingLocalMode: () => false,
      isResendConfigured: () => true,
    }));
    vi.doMock('@/lib/resend/server', () => ({
      getResendClient: () => ({
        emails: {
          send: async () => {
            throw new Error('timeout');
          },
        },
      }),
      getResendFromEmail: () => 'Ceramika Nero <rezerwacje@ceramikanero.pl>',
      getResendReplyToEmail: () => 'kontakt@ceramikanero.pl',
    }));

    const { deliverBookingEmail } = await import('../email-transport');
    const result = await deliverBookingEmail({
      bookingId: 'b1',
      type: 'cancellation',
      to: 'a@example.com',
      subject: 't',
      html: '<p>t</p>',
      text: 't',
    });

    expect(result.ok).toBe(false);
    expect(result.providerMessageId).toBeNull();
    expect(result.errorMessage).toMatch(/timeout/i);
  });
});
