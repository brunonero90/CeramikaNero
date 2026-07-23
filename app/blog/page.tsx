import Link from 'next/link';
import { services } from '@/lib/database/factory';
import { ThemeSuggestion } from '@/components/theme-suggestion';

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
      <h1 className="mb-6 text-3xl font-semibold">Blog</h1>
      {publishedPosts.length === 0 ? (
        <p className="text-gray-600">Brak opublikowanych wpisów.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {publishedPosts.map((post) => (
            <article key={post.id} className="rounded-lg border p-4">
              <h2 className="mb-2 text-xl font-medium">
                <Link href={`/blog/${post.slug}`} className="hover:underline">
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-gray-600">
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString('pl-PL')
                  : ''}
              </p>
              <p className="mt-2 text-gray-700">{post.excerpt}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
