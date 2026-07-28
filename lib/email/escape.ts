/** Escape text for safe inclusion in HTML attribute/text contexts. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a value that will appear inside a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

/** Strip control characters and normalize whitespace for plain-text email bodies. */
export function sanitizePlainText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
