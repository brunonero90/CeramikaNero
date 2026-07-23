import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Supported Markdown subset:
 *
 * - Paragraphs and line breaks
 * - Bold and italic inline emphasis
 * - Unordered and ordered lists
 * - Headings h1-h4
 * - Links with `href` only
 * - Blockquotes
 *
 * Arbitrary HTML, scripts, iframes, images and unsafe URL schemes are removed.
 */
export function renderMarkdown(input: string): string {
  const rawHtml = marked.parse(input, { async: false }) as string;
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'a',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Plain-text excerpt useful for SEO descriptions and cards. Strips Markdown
 * syntax without rendering to HTML.
 */
export function markdownToPlainText(input: string, maxLength: number): string {
  const plain = input
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength - 1).trimEnd() + '…';
}
