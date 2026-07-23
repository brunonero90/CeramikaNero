export function formatPrice(grosz: number, currency = 'PLN'): string {
  const pln = (grosz / 100).toFixed(2);
  return `${pln} ${currency}`;
}

export function groszFromPln(pln: number): number {
  return Math.round(pln * 100);
}

export function plnFromGrosz(grosz: number): number {
  return grosz / 100;
}
