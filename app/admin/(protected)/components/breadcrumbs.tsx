'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

const labelMap: Record<string, string> = {
  admin: 'Admin',
  kategorie: 'Kategorie',
  warsztaty: 'Warsztaty',
  terminy: 'Terminy',
  instruktorzy: 'Instruktorzy',
  strony: 'Strony',
  blog: 'Blog',
  galeria: 'Galeria',
  media: 'Media',
  ustawienia: 'Ustawienia',
  przekierowania: 'Przekierowania',
  uzytkownicy: 'Użytkownicy',
  audyt: 'Audyt',
  nowy: 'Nowy',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    const label = labelMap[segment] ?? segment;

    return (
      <li key={href} className="flex items-center gap-2">
        <span aria-hidden="true" className="text-gray-400">
          /
        </span>
        {isLast ? (
          <span className="text-gray-600">{label}</span>
        ) : (
          <Link href={href} className="hover:underline">
            {label}
          </Link>
        )}
      </li>
    );
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <li>
          <Link href="/admin">Admin</Link>
        </li>
        {crumbs}
      </ol>
    </nav>
  );
}
