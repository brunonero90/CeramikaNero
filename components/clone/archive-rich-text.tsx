import {
  parseArchiveText,
  splitInlineLinks,
  type ArchiveTextBlock,
} from '@/lib/clone/parse-archive-text';

function InlineText({ text }: { text: string }) {
  const parts = splitInlineLinks(text);
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <span key={i}>
              {part.value.split('\n').map((line, j, arr) => (
                <span key={j}>
                  {line}
                  {j < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </span>
          );
        }
        return (
          <a
            key={i}
            href={part.href}
            className="font-medium text-accent-primary underline-offset-2 hover:underline"
          >
            {part.value}
          </a>
        );
      })}
    </>
  );
}

function BlockView({ block }: { block: ArchiveTextBlock }) {
  switch (block.type) {
    case 'heading':
      if (block.level === 3) {
        return (
          <h3 className="font-heading text-xl font-semibold tracking-wide text-text-primary uppercase">
            {block.text}
          </h3>
        );
      }
      return (
        <h4 className="font-heading text-lg font-semibold text-text-primary">
          {block.text}
        </h4>
      );
    case 'paragraph':
      return (
        <p className="text-base leading-relaxed text-text-muted">
          <InlineText text={block.text} />
        </p>
      );
    case 'quote':
      return (
        <blockquote className="border-l-2 border-accent-primary/40 pl-4 text-base leading-relaxed text-text-muted italic">
          <InlineText text={block.text} />
        </blockquote>
      );
    case 'meta':
      return (
        <p className="text-sm leading-relaxed font-medium text-text-primary">
          <InlineText text={block.text} />
        </p>
      );
    case 'list':
      if (block.ordered) {
        return (
          <ol className="list-decimal space-y-2 pl-5 text-base text-text-primary">
            {block.items.map((item) => (
              <li key={item.slice(0, 64)} className="leading-relaxed">
                <InlineText text={item} />
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="space-y-2 text-base text-text-primary">
          {block.items.map((item) => (
            <li key={item.slice(0, 64)} className="flex gap-2 leading-relaxed">
              <span className="mt-1 text-accent-primary" aria-hidden>
                ■
              </span>
              <span className="text-text-muted">
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

/**
 * Render archived section body with paragraphs, lists, headings and meta lines.
 */
export function ArchiveRichText({
  text,
  className = 'mt-4 space-y-4',
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseArchiveText(text);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <BlockView
          key={`${block.type}-${index}-${
            block.type === 'list'
              ? block.items[0]?.slice(0, 24)
              : 'text' in block
                ? block.text.slice(0, 24)
                : index
          }`}
          block={block}
        />
      ))}
    </div>
  );
}
