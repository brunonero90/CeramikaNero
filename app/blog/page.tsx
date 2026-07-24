import type { Metadata } from 'next';
import { BlogIndexView, getOrderedBlogPosts } from '@/components/clone/blog';

export const metadata: Metadata = {
  title: 'Blog | Pracownia Ceramiki N',
  description:
    'Aktualności, ciekawostki i historie z Pracowni Ceramiki Nero — treść zarchiwizowana ze strony oryginalnej.',
};

export default function BlogPage() {
  return <BlogIndexView posts={getOrderedBlogPosts()} />;
}
