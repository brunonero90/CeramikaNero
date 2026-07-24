/**
 * Parse archived Wix section body text into structured blocks.
 * Source text comes from content.md section extraction (newline-preserving).
 * Does not invent wording — only classifies existing lines.
 */

export type ArchiveTextBlock =
  | { type: 'heading'; level: 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'meta'; text: string };

const BULLET = /^[■•●▪◦\-–—]\s*(.+)$/;
const NUMBERED = /^(\d+)[.)]\s+(.+)$/;
const PRICE_LINE = /^\s*(cena|price|od|pakiet|łącznie|koszt)[:\s].*\d/i;
const META_LINE =
  /^(tel\.?|telefon|e-?mail|mail|nip|numer konta|ul\.|adres|©)/i;
const FOOTER_NOISE =
  /^(zapisz się do newslettera|akceptuję regulamin|zapisując się do newslettera|©\s*\d{4}|polityka prywatności\s*$)/i;

function isShortHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (/[.!?]$/.test(t) && t.length > 40) return false;
  if (BULLET.test(t) || NUMBERED.test(t)) return false;
  if (PRICE_LINE.test(t) || META_LINE.test(t)) return false;
  // ALL CAPS / Title-like package names
  const letters = t.replace(/[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ]/g, '').length;
  if (upper / letters.length >= 0.72) return true;
  // Short standalone title without terminal punctuation
  if (t.length <= 48 && !/[.!?…]$/.test(t) && !t.includes('  ')) {
    const words = t.split(/\s+/);
    if (words.length <= 8 && words.every((w) => w[0] === w[0]?.toUpperCase())) {
      return true;
    }
  }
  return false;
}

function flushParagraph(lines: string[], blocks: ArchiveTextBlock[]): void {
  const text = lines.join('\n').trim();
  if (!text || FOOTER_NOISE.test(text)) return;
  if (PRICE_LINE.test(text) || META_LINE.test(text)) {
    blocks.push({ type: 'meta', text });
    return;
  }
  if (text.startsWith('"') || text.startsWith('„') || text.startsWith('«')) {
    blocks.push({ type: 'quote', text });
    return;
  }
  blocks.push({ type: 'paragraph', text });
}

/**
 * Convert a raw archive section body into typed blocks.
 */
export function parseArchiveText(raw: string): ArchiveTextBlock[] {
  if (!raw || !raw.trim()) return [];

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '');

  const lines = normalized.split('\n');
  const blocks: ArchiveTextBlock[] = [];
  let para: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({
      type: 'list',
      ordered: listOrdered,
      items: [...listItems],
    });
    listItems = [];
    listOrdered = false;
  };

  const flushPara = () => {
    if (para.length === 0) return;
    flushParagraph(para, blocks);
    para = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }

    if (FOOTER_NOISE.test(trimmed) && trimmed.length < 80) {
      flushList();
      flushPara();
      continue;
    }

    const bullet = trimmed.match(BULLET);
    if (bullet) {
      flushPara();
      if (listItems.length > 0 && listOrdered) flushList();
      listOrdered = false;
      listItems.push(bullet[1]!.trim());
      continue;
    }

    const numbered = trimmed.match(NUMBERED);
    if (numbered) {
      flushPara();
      if (listItems.length > 0 && !listOrdered) flushList();
      listOrdered = true;
      listItems.push(numbered[2]!.trim());
      continue;
    }

    if (
      isShortHeading(trimmed) &&
      para.length === 0 &&
      listItems.length === 0
    ) {
      flushList();
      flushPara();
      blocks.push({
        type: 'heading',
        level: trimmed.length <= 40 ? 3 : 4,
        text: trimmed,
      });
      continue;
    }

    flushList();
    para.push(trimmed);
  }

  flushList();
  flushPara();

  return mergeAdjacentParagraphs(blocks);
}

/** Keep intentional single newlines inside a paragraph as soft breaks via \n. */
function mergeAdjacentParagraphs(
  blocks: ArchiveTextBlock[]
): ArchiveTextBlock[] {
  return blocks.filter((b) => {
    if (b.type === 'paragraph' || b.type === 'meta' || b.type === 'quote') {
      return b.text.trim().length > 0;
    }
    if (b.type === 'list') return b.items.length > 0;
    if (b.type === 'heading') return b.text.trim().length > 0;
    return true;
  });
}

/** True when multi-paragraph archive text would collapse to one visual block. */
export function looksCollapsed(raw: string): boolean {
  const blocks = parseArchiveText(raw);
  const structural = blocks.filter(
    (b) => b.type === 'list' || b.type === 'heading' || b.type === 'paragraph'
  );
  const blankSeparated = (raw.match(/\n\s*\n/g) || []).length;
  const bulletCount = (raw.match(/^[■•]/gm) || []).length;
  if (blankSeparated >= 2 && structural.length < 2) return true;
  if (bulletCount >= 2 && !blocks.some((b) => b.type === 'list')) return true;
  return false;
}

/** Inline linkify emails and phones inside a text node (returns parts). */
export function splitInlineLinks(
  text: string
): Array<{ type: 'text' | 'mailto' | 'tel'; value: string; href?: string }> {
  const parts: Array<{
    type: 'text' | 'mailto' | 'tel';
    value: string;
    href?: string;
  }> = [];
  const re =
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|((?:\+48\s?)?(?:\d[\d\s-]{7,}\d))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) });
    }
    if (m[1]) {
      parts.push({ type: 'mailto', value: m[1], href: `mailto:${m[1]}` });
    } else if (m[2]) {
      const digits = m[2].replace(/[^\d+]/g, '');
      parts.push({
        type: 'tel',
        value: m[2],
        href: `tel:${digits.startsWith('+') ? digits : `+48${digits}`}`,
      });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) });
  }
  return parts.length ? parts : [{ type: 'text', value: text }];
}
