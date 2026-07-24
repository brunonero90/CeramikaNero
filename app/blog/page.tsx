import Image from 'next/image';
import Link from 'next/link';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';
import { getMigratedImageById } from '@/lib/media/wix-catalog';

export const metadata = {
  title: 'Blog | Ceramika Nero',
  description: 'Aktualności, inspiracje i informacje z pracowni Ceramika Nero.',
};

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await services.blogPosts.getAll();
  const publishedPosts = posts.filter(
    (post) => post.status === 'published' && !post.archivedAt
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <ThemeSuggestion theme="atelier" />
      <h1 className="mb-6 font-heading text-3xl font-semibold">Blog</h1>
      {publishedPosts.length === 0 ? (
        <p className="text-gray-600">Brak opublikowanych wpisów.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {publishedPosts.map((post) => {
            const image = getMigratedImageById(post.featuredMediaId ?? '');
            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-lg border"
              >
                {image && (
                  <div className="relative aspect-[16/9] w-full">
                    <Image
                      src={image.src}
                      alt={image.alt || post.title}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="mb-2 text-xl font-medium">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:underline"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-gray-600">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('pl-PL')
                      : ''}
                  </p>
                  <p className="mt-2 text-gray-700">{post.excerpt}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
