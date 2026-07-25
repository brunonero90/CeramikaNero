import type { LegalBlock } from '@/lib/clone/content/legal-documents';

export function LegalDocumentView({
  blocks,
  note,
}: {
  blocks: LegalBlock[];
  note?: string;
}) {
  return (
    <article className="mx-auto max-w-[720px] px-4 py-10 md:px-6 md:py-14">
      <div className="space-y-5 text-[15px] leading-[1.7] text-text-primary md:text-base">
        {blocks.map((block, index) => {
          if (block.type === 'h1') {
            return (
              <h1
                key={index}
                className="font-heading text-3xl font-semibold tracking-tight text-text-primary md:text-4xl"
              >
                {block.text}
              </h1>
            );
          }
          if (block.type === 'h2') {
            return (
              <h2
                key={index}
                className="font-heading mt-8 border-t border-surface-subtle/50 pt-6 text-xl font-semibold text-text-primary md:text-2xl"
              >
                {block.text}
              </h2>
            );
          }
          if (block.type === 'h3') {
            return (
              <h3
                key={index}
                className="font-heading mt-4 text-lg font-semibold text-text-primary"
              >
                {block.text}
              </h3>
            );
          }
          if (block.type === 'ul') {
            return (
              <ul
                key={index}
                className="list-disc space-y-2 pl-5 text-text-muted marker:text-accent-primary"
              >
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={index} className="text-text-muted">
              {block.text}
            </p>
          );
        })}
      </div>
      {note ? (
        <p className="mt-10 border-t border-surface-subtle/40 pt-4 text-xs leading-relaxed text-text-muted">
          {note}
        </p>
      ) : null}
    </article>
  );
}
