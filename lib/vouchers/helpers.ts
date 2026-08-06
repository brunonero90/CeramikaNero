import { createHash } from 'node:crypto';

export function normalizeVoucherCode(code: string): string {
  return code.trim().replace(/\s+/g, '').toUpperCase();
}

export function maskVoucherCode(code: string): string {
  const normalized = normalizeVoucherCode(code);
  return `••••${normalized.slice(-4)}`;
}

export function voucherRequestFingerprint(code: string): string {
  return createHash('sha256')
    .update(normalizeVoucherCode(code))
    .digest('hex')
    .slice(0, 16);
}

export function isAllowedVoucherProviderUrl(
  url: string,
  allowedHosts: string[]
): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      allowedHosts.some((host) => parsed.hostname === host.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function mapVoucherError(message?: string): string {
  const value = (message ?? '').toLowerCase();
  if (value.includes('not found') || value.includes('invalid')) {
    return 'Nie znaleziono bonu o takim kodzie.';
  }
  if (value.includes('expired')) return 'Ten bon stracił ważność.';
  if (value.includes('cancelled')) return 'Ten bon został anulowany.';
  if (value.includes('not active yet')) return 'Ten bon nie jest jeszcze aktywny.';
  if (value.includes('already been redeemed')) {
    return 'Ten bon został już wykorzystany.';
  }
  if (value.includes('workshop type') || value.includes('selected workshops')) {
    return 'Ten bon nie obejmuje wybranego warsztatu.';
  }
  if (value.includes('only be used for workshop')) {
    return 'Bon można wykorzystać wyłącznie na rezerwację warsztatów.';
  }
  if (value.includes('provider_') || value.includes('provider ')) {
    return 'Nie udało się teraz sprawdzić bonu u partnera. Bon nie został wykorzystany — spróbuj ponownie później.';
  }
  return 'Nie udało się sprawdzić bonu. Spróbuj ponownie.';
}
