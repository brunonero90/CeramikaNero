/**
 * Format an integer amount of Polish grosz into a human-readable PLN string.
 * 1 PLN = 100 grosz. Values are always stored and calculated as integers to
 * avoid floating-point errors.
 */
export function formatGroszAsPln(grosz: number): string {
  if (!Number.isFinite(grosz) || !Number.isInteger(grosz)) {
    throw new Error('Price must be a finite integer number of grosz');
  }
  const zloty = Math.floor(grosz / 100);
  const groszPart = Math.abs(grosz % 100);
  const formattedGrosz = groszPart.toString().padStart(2, '0');
  return `${zloty},${formattedGrosz} zł`;
}

/**
 * Convert a PLN amount in grosz to a złoty value with two decimal places.
 * Useful for calculations or display contexts that require a numeric string.
 */
export function groszToZloty(grosz: number): string {
  if (!Number.isFinite(grosz) || !Number.isInteger(grosz)) {
    throw new Error('Price must be a finite integer number of grosz');
  }
  return (grosz / 100).toFixed(2);
}

/**
 * Convert a złoty string (e.g. "123.45") to an integer number of grosz.
 * Useful for parsing user input or external data before storage.
 */
export function zlotyToGrosz(zloty: string | number): number {
  const parsed = typeof zloty === 'string' ? Number.parseFloat(zloty) : zloty;
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid zloty amount');
  }
  return Math.round(parsed * 100);
}
