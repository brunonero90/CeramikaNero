/**
 * Excel-safe CSV helpers for admin exports (UTF-8 + formula injection guard).
 */

export function csvEscapeCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>
): string {
  const lines = [
    headers.map((h) => csvEscapeCell(h)).join(','),
    ...rows.map((row) => row.map((c) => csvEscapeCell(c)).join(',')),
  ];
  // UTF-8 BOM helps Excel open Polish characters correctly.
  return `\uFEFF${lines.join('\n')}`;
}
