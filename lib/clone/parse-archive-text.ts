/**
 * Parse archived Wix section body text into structured blocks.
 *
 * IMPORTANT: Do not invent headings from length/case heuristics when original
 * evidence exists. Pass `knownHeadings` from page-spec.json (or DOM) so only
 * verified heading strings become heading blocks.
 */

export type ArchiveTextBlock =
  | { type: 'heading'; level: 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'meta'; text: string };

export type ParseArchiveTextOptions = {
  /**
   * Exact heading strings from archived page-spec / DOM (may include
   * embedded newlines). Only these lines are promoted to headings.
   * When omitted, NO line is promoted to a heading from heuristics.
   */
  knownHeadings?: readonly string[];
  /** Default heading level for known headings (section H2 is usually separate). */
  defaultHeadingLevel?: 2 | 3 | 4;
};

const BULLET = /^[■•●▪◦\-–—]\s*(.+)$/;
const NUMBERED = /^(\d+)[.)]\s+(.+)$/;
const PRICE_LINE = /^\s*(cena|price|od|pakiet|łącznie|koszt)[:\s].*\d/i;
const META_LINE =
  /^(tel\.?|telefon|e-?mail|mail|nip|numer konta|ul\.|adres|©)/i;
const FOOTER_NOISE =
  /^(zapisz się do newslettera|akceptuję regulamin|zapisując się do newslettera|©\s*\d{4}|polityka prywatności\s*$)/i;

function normalizeHeadingKey(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function buildKnownHeadingSet(
  knownHeadings: readonly string[] | undefined
): Set<string> {
  const set = new Set<string>();
  if (!knownHeadings) return set;
  for (const h of knownHeadings) {
    const key = normalizeHeadingKey(h);
    if (!key) continue;
    set.add(key);
    // Also accept single-line variants of multi-line headings
    for (const line of key.split('\n')) {
      if (line.length >= 3) set.add(line);
    }
  }
  return set;
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
 * Heading promotion is evidence-driven via `knownHeadings` only.
 */
export function parseArchiveText(
  raw: string,
  options: ParseArchiveTextOptions = {}
): ArchiveTextBlock[] {
  if (!raw || !raw.trim()) return [];

  const known = buildKnownHeadingSet(options.knownHeadings);
  const headingLevel = options.defaultHeadingLevel ?? 3;

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

  // Multi-line known headings: try to match consecutive lines
  const knownMulti = [...known].filter((k) => k.includes('\n'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();
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

    // Try multi-line known heading match starting at i
    let matchedMulti: string | null = null;
    let matchedSpan = 0;
    if (para.length === 0 && listItems.length === 0) {
      for (const multi of knownMulti) {
        const parts = multi.split('\n');
        const slice = lines
          .slice(i, i + parts.length)
          .map((l) => l.trim())
          .join('\n');
        if (normalizeHeadingKey(slice) === multi) {
          matchedMulti = multi;
          matchedSpan = parts.length;
          break;
        }
      }
    }
    if (matchedMulti) {
      flushList();
      flushPara();
      blocks.push({
        type: 'heading',
        level: headingLevel,
        text: matchedMulti,
      });
      i += matchedSpan - 1;
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
      known.has(normalizeHeadingKey(trimmed)) &&
      para.length === 0 &&
      listItems.length === 0
    ) {
      flushList();
      flushPara();
      blocks.push({
        type: 'heading',
        level: headingLevel,
        text: trimmed,
      });
      continue;
    }

    flushList();
    // Preserve original indentation-trimmed visual line; keep soft breaks
    para.push(trimmed);
  }

  flushList();
  flushPara();

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
