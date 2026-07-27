import { describe, expect, it } from 'vitest';
import { isResendConfigured } from '../local-mode';

describe('isResendConfigured', () => {
  it('requires api key, from, and reply-to', () => {
    const prev = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      RESEND_REPLY_TO_EMAIL: process.env.RESEND_REPLY_TO_EMAIL,
    };
    try {
      process.env.RESEND_API_KEY = 're_test';
      process.env.RESEND_FROM_EMAIL =
        'Ceramika Nero <rezerwacje@ceramikanero.pl>';
      delete process.env.RESEND_REPLY_TO_EMAIL;
      expect(isResendConfigured()).toBe(false);

      process.env.RESEND_REPLY_TO_EMAIL = 'kontakt@ceramikanero.pl';
      expect(isResendConfigured()).toBe(true);
    } finally {
      for (const [key, value] of Object.entries(prev)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
