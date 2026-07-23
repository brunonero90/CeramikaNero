import { describe, expect, it } from 'vitest';
import { renderMarkdown, markdownToPlainText } from '../markdown';

describe('renderMarkdown', () => {
  it('renders paragraphs and emphasis', () => {
    const html = renderMarkdown('Hello **world**');
    expect(html).toContain('<p>');
    expect(html).toContain('<strong>');
    expect(html).toContain('world');
  });

  it('removes script tags', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
  });

  it('removes arbitrary event handlers', () => {
    const html = renderMarkdown('<a href="/x" onclick="bad()">link</a>');
    expect(html).toContain('<a');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('bad()');
  });
});

describe('markdownToPlainText', () => {
  it('strips markdown syntax', () => {
    const text = markdownToPlainText('Hello [world](/w) **bold**', 100);
    expect(text).toBe('Hello world bold');
  });

  it('truncates long text', () => {
    const text = markdownToPlainText('a b c d e', 5);
    expect(text).toBe('a b…');
  });
});
