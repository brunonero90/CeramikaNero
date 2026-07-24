import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  BlogPostView,
  getBlogPost,
  getOrderedBlogPosts,
} from '@/components/clone/blog';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getOrderedBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(decodeURIComponent(slug));
  return {
    title: post ? `${post.title} | Blog` : 'Blog',
    description: post?.paragraphs.find((p) => p.length > 40)?.slice(0, 160),
  };
}

export default async function ArchiveBlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(decodeURIComponent(slug));
  if (!post) notFound();
  return <BlogPostView post={post} />;
}
