'use strict';

/**
 * Scaffold Phase 2 App Router pages for archive fixtures.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const archivePath = path.join(
  root,
  'lib/clone/content/phase2/archive-pages.ts'
);
const text = fs.readFileSync(archivePath, 'utf8');
const routes = [...text.matchAll(/"(\/[^"]+)": \{/g)].map((m) => m[1]);

function pageTemplate(route) {
  return `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import {
  bookingAdaptationFor,
  getArchivePage,
} from '@/lib/clone/archive';

const ROUTE = ${JSON.stringify(route)} as const;

export const metadata: Metadata = {
  title: getArchivePage(ROUTE)?.title ?? 'Ceramika Nero',
};

export default function ArchiveRoutePage() {
  const page = getArchivePage(ROUTE);
  if (!page) notFound();
  return (
    <ArchivePageView
      page={page}
      bookingAdaptation={bookingAdaptationFor(ROUTE) ?? undefined}
    />
  );
}
`;
}

for (const route of routes) {
  // Skip kontakt — handled separately with dedicated rewrite of existing page
  // Dynamic segments handled by [slug] templates below
  if (
    route.startsWith('/product-page/') ||
    route.startsWith('/service-page/') ||
    route.startsWith('/booking-calendar/') ||
    route.startsWith('/courses/') ||
    route.startsWith('/szczeg-y-wydarzenia-i-rejestracja/')
  ) {
    continue;
  }
  if (route === '/courses') {
    // keep
  }
  const rel =
    route === '/' ? 'page.tsx' : path.join(route.slice(1), 'page.tsx');
  const file = path.join(root, 'app', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Don't overwrite home marketing pages already in Phase 1
  const skip = new Set([
    'app/page.tsx',
    'app/pracownia/page.tsx',
    'app/galeria/page.tsx',
    'app/home/page.tsx',
  ]);
  if (skip.has(path.relative(root, file).replace(/\\/g, '/'))) continue;
  fs.writeFileSync(file, pageTemplate(route));
  console.log('wrote', path.relative(root, file));
}

// Dynamic templates
const dynamics = [
  {
    dir: 'app/product-page/[slug]',
    prefix: '/product-page/',
  },
  {
    dir: 'app/service-page/[slug]',
    prefix: '/service-page/',
  },
  {
    dir: 'app/booking-calendar/[slug]',
    prefix: '/booking-calendar/',
  },
  {
    dir: 'app/courses/[slug]',
    prefix: '/courses/',
  },
  {
    dir: 'app/szczeg-y-wydarzenia-i-rejestracja/[slug]',
    prefix: '/szczeg-y-wydarzenia-i-rejestracja/',
  },
];

for (const d of dynamics) {
  const file = path.join(root, d.dir, 'page.tsx');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = `import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArchivePageView } from '@/components/clone/archive-page';
import {
  bookingAdaptationFor,
  getArchivePage,
  listArchiveRoutes,
} from '@/lib/clone/archive';

const PREFIX = ${JSON.stringify(d.prefix)} as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return listArchiveRoutes()
    .filter((r) => r.startsWith(PREFIX))
    .map((r) => ({ slug: decodeURIComponent(r.slice(PREFIX.length)) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getArchivePage(PREFIX + slug);
  return { title: page?.title ?? 'Ceramika Nero' };
}

export default async function DynamicArchivePage({ params }: Props) {
  const { slug } = await params;
  const route = PREFIX + slug;
  const page = getArchivePage(route);
  if (!page) notFound();
  return (
    <ArchivePageView
      page={page}
      bookingAdaptation={bookingAdaptationFor(route) ?? undefined}
    />
  );
}
`;
  fs.writeFileSync(file, content);
  console.log('wrote', path.relative(root, file));
}

console.log('done', routes.length);
