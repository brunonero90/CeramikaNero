import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  ResolvedArchivePage,
  resolvedArchiveTitle,
} from '@/components/clone/resolved-archive-page';
import { listArchiveRoutes } from '@/lib/clone/archive';

type Props = { params: Promise<{ slug: string }> };

export function createDynamicArchiveHandlers(prefix: `/${string}/`) {
  function generateStaticParams() {
    return listArchiveRoutes()
      .filter((r) => r.startsWith(prefix))
      .map((r) => {
        const raw = r.slice(prefix.length);
        try {
          return { slug: decodeURIComponent(raw) };
        } catch {
          return { slug: raw };
        }
      });
  }

  async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const route = prefix + slug;
    return {
      title: await resolvedArchiveTitle(route, 'Ceramika Nero'),
    };
  }

  async function Page({ params }: Props) {
    const { slug } = await params;
    const route = prefix + slug;
    // Validate route exists in archive/CMS registry via ResolvedArchivePage notFound.
    return <ResolvedArchivePage route={route} />;
  }

  return { generateStaticParams, generateMetadata, Page, notFound };
}
