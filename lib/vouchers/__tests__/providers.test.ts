import { describe, expect, it } from 'vitest';
import {
  isAllowedVoucherProviderUrl,
  mapVoucherError,
  maskVoucherCode,
  normalizeVoucherCode,
  voucherRequestFingerprint,
} from '@/lib/vouchers/helpers';

describe('voucher provider helpers', () => {
  it('normalizes and masks codes without logging the full value', () => {
    expect(normalizeVoucherCode(' pm 12-34 abcd ')).toBe('PM12-34ABCD');
    expect(maskVoucherCode(' pm 12-34 abcd ')).toBe('••••ABCD');
    expect(voucherRequestFingerprint('secret-code')).toHaveLength(16);
    expect(voucherRequestFingerprint('secret-code')).not.toContain('SECRET');
  });

  it('only allows HTTPS provider endpoints on configured hosts', () => {
    expect(
      isAllowedVoucherProviderUrl('https://api.partner.test/v1/voucher', [
        'api.partner.test',
      ])
    ).toBe(true);
    expect(
      isAllowedVoucherProviderUrl('http://api.partner.test/v1/voucher', [
        'api.partner.test',
      ])
    ).toBe(false);
    expect(
      isAllowedVoucherProviderUrl('https://attacker.test/v1/voucher', [
        'api.partner.test',
      ])
    ).toBe(false);
  });

  it('maps voucher failures to safe customer messages', () => {
    expect(mapVoucherError('Voucher is expired')).toContain('stracił ważność');
    expect(mapVoucherError('Voucher has already been redeemed')).toContain(
      'już wykorzystany'
    );
    expect(mapVoucherError('provider_http_503')).toContain(
      'nie został wykorzystany'
    );
  });
});
