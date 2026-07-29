const PLN_INPUT = /^\d{1,8}(?:[.,]\d{1,2})?$/;

/**
 * Parse an admin-entered PLN amount without floating-point rounding,
 * exponents, signs, or values outside PostgreSQL integer grosz.
 */
export function parsePlnToGrosz(raw: string): number | null {
  const normalized = raw.trim();
  if (!PLN_INPUT.test(normalized)) return null;

  const [whole, fraction = ''] = normalized.replace(',', '.').split('.');
  const grosz = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(grosz) || grosz > 2_147_483_647) return null;
  return grosz;
}
