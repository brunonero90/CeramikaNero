import Image from 'next/image';
import Link from 'next/link';
import { BlogCategoryNav } from '@/components/clone/archive-page';
import { ArchiveRichText } from '@/components/clone/archive-rich-text';
import { archiveBlogPosts } from '@/lib/clone/content/phase2/blog-posts';
import { knownHeadingsForSection } from '@/lib/clone/page-spec-headings';

const NOISE =
  /^(Udostępnij post|Wszystkie|Aktualności|O mnie|Ciekawostki|\d+ wyświetleń|0 komentarzy|Post nie został|Ostatnie posty|Zobacz wszystkie|Komentarze|Napisz komentarz)/i;

export function getOrderedBlogPosts() {
  const bySlug = new Map(
    archiveBlogPosts.posts.map((p) => [p.slug, p] as const)
  );
  const ordered: (typeof archiveBlogPosts.posts)[number][] = [];
  for (const slug of archiveBlogPosts.indexOrder) {
    const post = bySlug.get(slug);
    if (post) {
      ordered.push(post);
      bySlug.delete(slug);
    }
  }
  for (const post of bySlug.values()) ordered.push(post);
  return ordered;
}

export function getBlogPost(slug: string) {
  return archiveBlogPosts.posts.find((p) => p.slug === slug) ?? null;
}

export function BlogIndexView({
  posts,
  categoryLabel,
}: {
  posts: ReturnType<typeof getOrderedBlogPosts>;
  categoryLabel?: string;
}) {
  return (
    <div className="bg-surface-bg">
      <header className="mx-auto max-w-3xl px-4 pt-12 pb-4 text-center md:px-6">
        <h1 className="font-heading text-4xl font-semibold text-text-primary">
          Blog
        </h1>
        {categoryLabel ? (
          <p className="mt-2 text-sm font-semibold tracking-wide text-text-muted uppercase">
            {categoryLabel}
          </p>
        ) : null}
      </header>
      <BlogCategoryNav active={categoryLabel} />
      <div className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 md:grid-cols-2 md:px-6">
        {posts.map((post) => {
          const excerpt =
            post.paragraphs.find((p) => p.length > 40 && !NOISE.test(p)) ??
            post.paragraphs[0] ??
            '';
          const img = post.images[0];
          return (
            <article
              key={post.slug}
              className="flex flex-col border border-surface-subtle/40 bg-surface-raised"
            >
              {img?.src ? (
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={img.src}
                    alt={img.alt || post.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              ) : null}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-heading text-xl font-semibold text-text-primary">
                  <Link
                    href={post.route}
                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 text-xs text-text-muted">
                  {post.author}
                  {post.date ? ` · ${post.date}` : ''}
                </p>
                <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-text-muted">
                  {excerpt}
                </p>
                <Link
                  href={post.route}
                  className="mt-auto pt-4 text-sm font-semibold text-accent-primary underline-offset-2 hover:underline"
                >
                  Czytaj dalej
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function BlogPostView({
  post,
}: {
  post: NonNullable<ReturnType<typeof getBlogPost>>;
}) {
  const body = post.paragraphs.filter((p) => !NOISE.test(p) && p.length > 1);
  return (
    <article className="bg-surface-bg">
      <header className="mx-auto max-w-3xl px-4 pt-12 pb-4 text-center md:px-6">
        <BlogCategoryNav />
        <h1 className="font-heading text-3xl font-semibold text-text-primary md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-text-muted">
          {post.author}
          {post.date ? ` · ${post.date}` : ''}
          {post.readingTime ? ` · ${post.readingTime}` : ''}
        </p>
      </header>
      {post.images[0]?.src ? (
        <div className="relative mx-auto mt-6 aspect-[16/9] w-full max-w-3xl overflow-hidden px-4 md:px-6">
          <div className="relative h-full w-full">
            <Image
              src={post.images[0].src}
              alt={post.images[0].alt || post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
              priority
            />
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-prose px-4 py-10 md:px-6">
        <ArchiveRichText
          text={body.join('\n\n')}
          knownHeadings={knownHeadingsForSection(post.route, 0)}
          className="space-y-5"
        />
      </div>
      <div className="mx-auto max-w-3xl px-4 pb-16 md:px-6">
        <Link
          href="/blog"
          className="text-sm font-semibold text-accent-primary underline-offset-2 hover:underline"
        >
          ← Wróć do bloga
        </Link>
      </div>
    </article>
  );
}
